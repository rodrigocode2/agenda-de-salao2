/* ==========================================================
   AGENDA RESPONSIVA — Dia e Semana num componente só.
   - Desenha em #agenda-app (ver index.html) e usa os modais do App
     (abrirMarcar, abrirEncaixe, mudarStatusAgendamento, excluirAgendamento).
   - Todo texto vindo do banco entra por textContent (nada de innerHTML).
   - A data escolhida fica espelhada em #filtro-data-agenda, que o resto
     do app já lê.
   ========================================================== */
const Agenda = (function () {
  'use strict';

  var DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  var DIAS_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var STATUS = { espera: 'Em espera', atendendo: 'Atendendo', finalizado: 'Finalizado', faltou: 'Faltou' };
  var ORDEM_STATUS = ['espera', 'atendendo', 'finalizado', 'faltou'];
  var INI_PADRAO = 8 * 60, FIM_PADRAO = 19 * 60, PASSO = 30, TOPO = 12;
  var K_MODO = 'hairconcept_modo_agenda';
  var K_PROF = 'hairconcept_prof_selecionado';
  var K_SEL = 'hairconcept_agenda_selecao';

  var est = {
    pronto: false,
    modo: null,
    data: null,          // ISO yyyy-mm-dd
    sel: [],             // ids dos profissionais exibidos
    rolar: true,
    profs: [],
    ags: [],
    bloqueios: [],
    votos: {},
    totalClientes: 0,
    chave: '',           // semana + salão já carregados
    faixaIni: INI_PADRAO,
    faixaFim: FIM_PADRAO,
    carregando: false,
    pendente: false
  };
  var raiz = null, ro = null, quadro = 0;

  // ---------- utilidades ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem storage */ } }
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function hhmm(v) { return String(v || '').slice(0, 5); }
  function min(h) {
    var p = hhmm(h).split(':');
    var m = (+p[0]) * 60 + (+p[1] || 0);
    return isFinite(m) ? m : -1;
  }
  function hh(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function iso(d) { return dataLocalISO(d); }
  function paraData(s) { return new Date(s + 'T00:00:00'); }
  function somar(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function segunda(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function ajustarDomingo(s, passo) {
    var d = paraData(s);
    if (d.getDay() === 0) d = somar(d, passo >= 0 ? 1 : -1);
    return iso(d);
  }
  function rotuloData(d) { return d.getDate() + ' ' + MESES[d.getMonth()]; }
  function css(nome, padrao) {
    var v = parseFloat(getComputedStyle(raiz).getPropertyValue(nome));
    return isFinite(v) ? v : padrao;
  }
  function ehAdmin() { return !!(App.user && App.user.role === 'admin'); }
  function ehProf() { return !!(App.user && App.user.role === 'profissional'); }
  function grana(v) {
    var n = parseFloat(v);
    return 'R$ ' + (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function statusDe(a) {
    var s = String(a.status || 'espera').toLowerCase();
    return STATUS[s] ? s : 'espera';
  }
  function ativos() { return est.profs.filter(function (p) { return p.ativo !== false; }); }
  function profPorId(id) { return est.profs.filter(function (p) { return p.id === id; })[0]; }
  function iniciais(nome) {
    var t = String(nome || '').trim().split(/\s+/);
    if (!t[0]) return '?';
    return (t[0][0] + (t.length > 1 ? t[t.length - 1][0] : (t[0][1] || ''))).toUpperCase();
  }
  function inicioFim(a) {
    var i = min(a.horario);
    var f = a.horario_fim ? min(a.horario_fim) : -1;
    if (f <= i) {
      var dur = 0;
      try { dur = App.duracaoMinutos(a); } catch (e) { dur = 0; }
      f = i + (dur > 0 ? dur : PASSO);
    }
    return [i, f];
  }

  // ---------- dados ----------
  async function carregar(forcar) {
    var estabId = await App.obterEstabId();
    if (!estabId) return false;
    var seg = segunda(paraData(est.data));
    var de = iso(seg), ate = iso(somar(seg, 5));
    var chave = estabId + '|' + de;
    if (!forcar && chave === est.chave) return true;

    var rp = await supabaseClient.from('profissionais')
      .select('id, nome, cargo, foto_url, ativo, comissao_pct')
      .eq('estabelecimento_id', estabId);
    if (rp.error) rp = await supabaseClient.from('profissionais').select('*').eq('estabelecimento_id', estabId);
    est.profs = (rp.data || []).slice().sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });

    var q = supabaseClient.from('agendamentos').select('*')
      .eq('estabelecimento_id', estabId).gte('data', de).lte('data', ate);
    if (ehProf() && App.user.id) q = q.eq('profissional_id', App.user.id);
    var ra = await q;
    est.ags = ra.data || [];

    est.bloqueios = [];
    try {
      var rb = await supabaseClient.rpc('bloqueios_do_periodo', { p_de: de, p_ate: ate });
      est.bloqueios = rb.data || [];
    } catch (e) { console.warn('Bloqueios indisponiveis:', e); }

    // estrelas e selo de certificado (cada um por si: se falhar, a agenda segue)
    try {
      var rv = await supabaseClient.from('avaliacoes_cliente').select('profissional_id, tipo').eq('estabelecimento_id', estabId);
      var votos = {};
      (rv.data || []).forEach(function (v) {
        if (v.profissional_id && v.tipo === 'mais') votos[v.profissional_id] = (votos[v.profissional_id] || 0) + 1;
      });
      est.votos = votos;
      var rc = await supabaseClient.from('clientes').select('*', { count: 'exact', head: true }).eq('estabelecimento_id', estabId);
      est.totalClientes = rc.count || 0;
    } catch (e) { console.warn('Estrelas indisponiveis:', e); }
    try { if (!App._temCertificado) await App.carregarSeloCertificados(); }
    catch (e) { console.warn('Selos indisponiveis:', e); }

    est.chave = chave;
    return true;
  }

  function eventos(profId, dataISO) {
    return est.ags.filter(function (a) { return a.profissional_id === profId && String(a.data).slice(0, 10) === dataISO; });
  }
  function fechamentos(profId, dataISO) {
    return est.bloqueios.filter(function (b) {
      if (String(b.data).slice(0, 10) !== dataISO) return false;
      return !b.profissional_id || b.profissional_id === profId;
    });
  }

  // ---------- seleção ----------
  function ajustarSelecao() {
    var lista = ativos();
    var ids = lista.map(function (p) { return p.id; });
    if (ehProf()) { est.sel = ids.indexOf(App.user.id) >= 0 || !ids.length ? [App.user.id] : [App.user.id]; return; }
    var s = est.sel.filter(function (id) { return ids.indexOf(id) >= 0; });
    if (!s.length) {
      var salvo = ler(K_PROF);
      s = [ids.indexOf(salvo) >= 0 ? salvo : ids[0]].filter(Boolean);
    }
    est.sel = s;
  }
  function guardarSelecao() {
    if (est.sel[0]) guardar(K_PROF, est.sel[0]);
    guardar(K_SEL, JSON.stringify(est.sel));
  }
  function capacidadeDia() {
    var larg = $('ga-painel').clientWidth - css('--ga-hw', 52);
    return Math.max(1, Math.floor(larg / 150));
  }

  // ---------- colunas visíveis conforme a largura ----------
  function colunas() {
    var larg = $('ga-painel').clientWidth - css('--ga-hw', 52);
    var seg = segunda(paraData(est.data));
    var todas, minCol;
    if (est.modo === 'semana') {
      todas = [0, 1, 2, 3, 4, 5].map(function (i) { return { tipo: 'dia', iso: iso(somar(seg, i)), prof: est.sel[0] }; });
      minCol = 108;
    } else {
      todas = est.sel.map(function (id) { return { tipo: 'prof', prof: id, iso: est.data }; });
      minCol = 150;
    }
    var cabem = Math.max(1, Math.floor(larg / minCol));
    var visiveis = Math.min(todas.length, cabem);
    var inicio = 0;
    if (est.modo === 'semana') {
      var idx = Math.max(0, Math.min(5, (paraData(est.data).getDay() + 6) % 7));
      inicio = Math.max(0, Math.min(idx, todas.length - visiveis));
      if (visiveis < todas.length && idx >= inicio + visiveis) inicio = idx - visiveis + 1;
    }
    return { todas: todas, lista: todas.slice(inicio, inicio + visiveis), cortou: todas.length - visiveis };
  }

  // ---------- encaixes lado a lado ----------
  function distribuir(lista) {
    var ev = lista.map(function (a) { var t = inicioFim(a); return { a: a, ini: t[0], fim: t[1], lane: 0, n: 1 }; })
      .filter(function (x) { return x.ini >= 0; })
      .sort(function (x, y) { return x.ini - y.ini || y.fim - x.fim; });
    var grupo = [], fimGrupo = -1;
    function fechar() {
      var n = 0; grupo.forEach(function (g) { n = Math.max(n, g.lane + 1); });
      grupo.forEach(function (g) { g.n = n; });
      grupo = [];
    }
    ev.forEach(function (x) {
      if (grupo.length && x.ini >= fimGrupo) { fechar(); fimGrupo = -1; }
      var usadas = grupo.filter(function (g) { return g.fim > x.ini; }).map(function (g) { return g.lane; });
      var l = 0; while (usadas.indexOf(l) >= 0) l++;
      x.lane = l; grupo.push(x); fimGrupo = Math.max(fimGrupo, x.fim);
    });
    fechar();
    return ev;
  }

  // ---------- esqueleto ----------
  function montar() {
    raiz = $('agenda-app');
    if (!raiz || raiz.dataset.pronto) return !!raiz;
    raiz.dataset.pronto = '1';
    raiz.replaceChildren();

    var topo = el('header', 'ga-topo');
    var tit = el('div', 'ga-titulo');
    tit.appendChild(el('h2', null, 'Agenda'));
    var faixa = el('p'); faixa.id = 'ga-faixa'; tit.appendChild(faixa);
    topo.appendChild(tit);

    var nav = el('div', 'ga-grupo'); nav.setAttribute('role', 'group'); nav.setAttribute('aria-label', 'Navegar no calendário');
    nav.appendChild(botao('‹', 'ga-ant', 'Anterior'));
    nav.appendChild(botao('Hoje', 'ga-hoje'));
    nav.appendChild(botao('›', 'ga-prox', 'Próximo'));
    topo.appendChild(nav);

    var dataIn = el('input', 'ga-data'); dataIn.type = 'date'; dataIn.id = 'ga-data';
    dataIn.setAttribute('aria-label', 'Ir para uma data');
    dataIn.addEventListener('change', function () { if (dataIn.value) irPara(dataIn.value); });
    topo.appendChild(dataIn);

    var modo = el('div', 'ga-grupo modo'); modo.setAttribute('role', 'tablist'); modo.setAttribute('aria-label', 'Modo da agenda');
    var bd = botao('Dia', 'ga-m-dia'); bd.setAttribute('role', 'tab');
    var bs = botao('Semana', 'ga-m-semana'); bs.setAttribute('role', 'tab');
    modo.appendChild(bd); modo.appendChild(bs);
    topo.appendChild(modo);

    var fechar = botao('Fechar horário', 'ga-fechar'); fechar.classList.add('ga-sec');
    topo.appendChild(fechar);
    var novo = botao('+ Novo agendamento', 'ga-novo-btn'); novo.classList.add('ga-novo');
    topo.appendChild(novo);
    raiz.appendChild(topo);

    var profs = el('div', 'ga-profs'); profs.id = 'ga-profs'; profs.setAttribute('role', 'group'); profs.setAttribute('aria-label', 'Profissionais');
    raiz.appendChild(profs);
    var dias = el('div', 'ga-dias'); dias.id = 'ga-dias'; dias.hidden = true;
    raiz.appendChild(dias);
    var painel = el('section', 'ga-painel'); painel.id = 'ga-painel'; painel.setAttribute('aria-label', 'Agenda');
    raiz.appendChild(painel);

    var leg = el('div', 'ga-legenda'); leg.setAttribute('aria-label', 'Legenda');
    ORDEM_STATUS.forEach(function (s) {
      var sp = el('span', 'st-' + s); sp.appendChild(el('i')); sp.appendChild(document.createTextNode(STATUS[s])); leg.appendChild(sp);
    });
    raiz.appendChild(leg);
    var aviso = el('p', 'ga-aviso'); aviso.id = 'ga-aviso'; aviso.hidden = true;
    raiz.appendChild(aviso);

    var fab = el('button', 'ga-fab', '+'); fab.type = 'button'; fab.id = 'ga-fab'; fab.setAttribute('aria-label', 'Novo agendamento');
    raiz.appendChild(fab);
    var dlg = el('dialog', 'ga-dlg'); dlg.id = 'ga-dlg'; dlg.appendChild(el('div', 'ga-dlg-in')); dlg.firstChild.id = 'ga-dlg-in';
    raiz.appendChild(dlg);

    $('ga-ant').addEventListener('click', function () { andar(-1); });
    $('ga-prox').addEventListener('click', function () { andar(1); });
    $('ga-hoje').addEventListener('click', function () { irPara(iso(new Date())); });
    $('ga-m-dia').addEventListener('click', function () { trocarModo('dia'); });
    $('ga-m-semana').addEventListener('click', function () { trocarModo('semana'); });
    $('ga-novo-btn').addEventListener('click', function () { novoAgendamento(est.data, null, null); });
    $('ga-fab').addEventListener('click', function () { novoAgendamento(est.data, null, null); });
    $('ga-fechar').addEventListener('click', function () { janelaFechar(); });
    painel.addEventListener('click', cliquePainel);
    painel.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('ga-col') && ehAdmin()) {
        ev.preventDefault();
        novoAgendamento(ev.target.dataset.data, ev.target.dataset.prof, null);
      }
    });

    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        cancelAnimationFrame(quadro);
        quadro = requestAnimationFrame(function () { if (est.pronto) desenhar(); });
      });
      ro.observe(painel);
    }
    return true;
  }
  function botao(txt, id, rotulo) {
    var b = el('button', 'ga-btn', txt); b.type = 'button'; b.id = id;
    if (rotulo) b.setAttribute('aria-label', rotulo);
    return b;
  }

  // ---------- desenho ----------
  function desenhar() {
    if (!raiz || !est.pronto) return;
    var painel = $('ga-painel');
    var ROW = css('--ga-row', 44);

    // faixa de horas: padrão 8–19h, ampliada se houver atendimento fora dela
    var ini = INI_PADRAO, fim = FIM_PADRAO;
    est.ags.forEach(function (a) {
      var t = inicioFim(a);
      if (t[0] >= 0) { ini = Math.min(ini, Math.floor(t[0] / 60) * 60); fim = Math.max(fim, Math.ceil(t[1] / 60) * 60); }
    });
    ini = Math.max(0, ini); fim = Math.min(24 * 60, fim);
    est.faixaIni = ini; est.faixaFim = fim;
    var altura = ((fim - ini) / PASSO) * ROW + TOPO + 8;

    var cols = colunas();
    var dataSel = paraData(est.data);
    var seg = segunda(dataSel), sab = somar(seg, 5);
    var texto = (est.modo === 'semana' && cols.cortou === 0)
      ? seg.getDate() + ' – ' + rotuloData(sab) + ' ' + sab.getFullYear()
      : DIAS_LONGO[dataSel.getDay()] + ', ' + rotuloData(dataSel) + ' ' + dataSel.getFullYear();
    $('ga-faixa').textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
    $('ga-data').value = est.data;
    $('ga-m-dia').setAttribute('aria-selected', String(est.modo === 'dia'));
    $('ga-m-semana').setAttribute('aria-selected', String(est.modo === 'semana'));

    ['ga-fechar', 'ga-novo-btn', 'ga-fab'].forEach(function (id) { $(id).hidden = !ehAdmin(); });
    desenharProfs();
    desenharDias(cols);

    var grade = el('div', 'ga-grade');
    grade.style.setProperty('--ga-cols', Math.max(1, cols.lista.length));
    grade.appendChild(el('div', 'ga-cab ga-cab-hora'));
    cols.lista.forEach(function (c) { grade.appendChild(cabecalho(c)); });

    var horas = el('div', 'ga-horas');
    horas.style.height = altura + 'px';
    for (var m = ini; m <= fim; m += 60) {
      var r = el('span', 'ga-hora-rot', hh(m));
      r.style.top = (TOPO + ((m - ini) / PASSO) * ROW) + 'px';
      horas.appendChild(r);
    }
    grade.appendChild(horas);
    cols.lista.forEach(function (c) { grade.appendChild(corpo(c, altura, ROW, ini, fim)); });

    var rolagem = painel.scrollTop;
    painel.replaceChildren(grade);
    painel.scrollTop = rolagem;

    var aviso = $('ga-aviso');
    if (est.modo === 'dia' && est.sel.length > cols.lista.length) {
      var q = cols.lista.length;
      aviso.textContent = 'Nesta tela cabe ' + q + (q === 1 ? ' profissional' : ' profissionais') + ' por vez. Desmarque algum para ver os outros.';
      aviso.hidden = false;
    } else if (!ativos().length) {
      aviso.textContent = 'Cadastre profissionais na aba Equipe para ver a agenda.';
      aviso.hidden = false;
    } else { aviso.hidden = true; }

    if (est.rolar) {
      est.rolar = false;
      var agora = new Date();
      var minAgora = agora.getHours() * 60 + agora.getMinutes();
      var alvo = est.data === iso(agora) ? minAgora - 60 : ini + 30;
      painel.scrollTop = Math.max(0, ((alvo - ini) / PASSO) * ROW);
    }
  }

  function estrelas(profId) {
    var pts = est.votos[profId] || 0;
    var e = App.calcularEstrelaProf(pts, est.totalClientes);
    var box = el('span', 'ga-est');
    var i;
    for (i = 0; i < e.cheias; i++) box.appendChild(el('i', 'fa-solid fa-star'));
    if (e.meia) box.appendChild(el('i', 'fa-solid fa-star-half-stroke'));
    for (i = 0; i < e.vazias; i++) { var v = el('i', 'fa-regular fa-star vz'); box.appendChild(v); }
    box.appendChild(el('span', 'ct', pts + '/' + est.totalClientes));
    return box;
  }

  function cabecalho(c) {
    var th = el('div', 'ga-cab');
    if (c.tipo === 'dia') {
      var d = paraData(c.iso);
      var q = c.prof ? eventos(c.prof, c.iso).length : 0;
      var box = el('button', 'ga-cab-dia' + (c.iso === iso(new Date()) ? ' hoje' : ''));
      box.type = 'button';
      box.dataset.dia = c.iso;
      box.setAttribute('aria-label', 'Abrir ' + DIAS_LONGO[d.getDay()] + ', ' + rotuloData(d));
      box.appendChild(el('small', null, DIAS[(d.getDay() + 6) % 7]));
      box.appendChild(el('b', null, String(d.getDate())));
      box.appendChild(el('em', null, q ? q + (q === 1 ? ' atend.' : ' atends.') : '—'));
      th.appendChild(box);
    } else {
      var p = profPorId(c.prof) || { nome: '?' };
      var n = eventos(c.prof, c.iso).length;
      var b = el('div', 'ga-cab-prof');
      b.appendChild(avatar(p));
      var t = el('span', 't');
      t.appendChild(el('strong', null, p.nome || ''));
      t.appendChild(el('em', null, n ? n + (n === 1 ? ' atendimento' : ' atendimentos') : 'livre'));
      t.appendChild(estrelas(c.prof));
      var qc = (App._certPorProf && App._certPorProf[c.prof]) || 0;
      if (qc > 0) {
        var s = el('span', 'ga-cert');
        s.title = qc === 1 ? '1 curso registrado' : qc + ' cursos registrados';
        s.appendChild(el('i', 'fa-solid fa-graduation-cap'));
        s.appendChild(document.createTextNode(' ' + qc + (qc === 1 ? ' curso' : ' cursos')));
        t.appendChild(s);
      }
      b.appendChild(t);
      th.appendChild(b);
    }
    return th;
  }

  function avatar(p) {
    var a = el('span', 'ga-avatar');
    if (p.foto_url) {
      var img = el('img'); img.src = p.foto_url; img.alt = ''; img.loading = 'lazy';
      img.addEventListener('error', function () { a.replaceChildren(document.createTextNode(iniciais(p.nome))); });
      a.appendChild(img);
    } else a.textContent = iniciais(p.nome);
    return a;
  }

  function corpo(c, altura, ROW, ini, fim) {
    var profId = c.prof;
    var p = profPorId(profId) || { nome: '' };
    var hojeISO = iso(new Date());
    var col = el('div', 'ga-col' + (c.iso === hojeISO ? ' hoje' : '') + (ehAdmin() ? ' pode' : ''));
    col.style.height = altura + 'px';
    col.dataset.prof = profId || '';
    col.dataset.data = c.iso;
    col.tabIndex = ehAdmin() ? 0 : -1;
    col.setAttribute('aria-label', 'Horários de ' + (p.nome || '') + ', ' + rotuloData(paraData(c.iso)));

    // dias/horários fechados
    fechamentos(profId, c.iso).forEach(function (b) {
      var a = b.hora_inicio ? min(b.hora_inicio) : ini;
      var f = b.hora_inicio ? min(b.hora_fim) : fim;
      if (a < 0 || f <= a) return;
      a = Math.max(a, ini); f = Math.min(f, fim);
      var fx = el('button', 'ga-fechado' + (ehAdmin() ? ' edit' : ''));
      fx.type = 'button';
      fx.style.top = (TOPO + ((a - ini) / PASSO) * ROW) + 'px';
      fx.style.height = (((f - a) / PASSO) * ROW) + 'px';
      var rot = (b.motivo || 'Fechado') + (b.profissional_id ? '' : ' · equipe toda');
      fx.appendChild(el('span', null, rot));
      fx._bloqueio = b;
      col.appendChild(fx);
    });

    distribuir(eventos(profId, c.iso)).forEach(function (x) {
      var a = x.a, dur = x.fim - x.ini, st = statusDe(a);
      var b = el('button', 'ga-bloco st-' + st + (st === 'finalizado' || st === 'faltou' ? ' ' + st : ''));
      b.type = 'button';
      b.style.top = (TOPO + ((x.ini - ini) / PASSO) * ROW + 1) + 'px';
      b.style.height = Math.max(ROW * 0.7, (dur / PASSO) * ROW - 2) + 'px';
      b.style.left = 'calc(' + (x.lane / x.n * 100) + '% + 2px)';
      b.style.width = 'calc(' + (100 / x.n) + '% - 4px)';
      b.style.zIndex = 3;
      if (dur <= PASSO) b.classList.add('curto');
      if (x.n > 1) b.classList.add('estreito');
      b.appendChild(el('span', 'n', a.cliente || ''));
      b.appendChild(el('span', 's', a.servico || ''));
      b.appendChild(el('span', 'h', hh(x.ini) + ' – ' + hh(x.fim)));
      b.setAttribute('aria-label', (a.cliente || '') + ', ' + (a.servico || '') + ', ' + hh(x.ini) + ' às ' + hh(x.fim) + ', ' + STATUS[st]);
      b._ag = a;
      col.appendChild(b);
    });

    if (c.iso === hojeISO) {
      var ag = new Date(), m = ag.getHours() * 60 + ag.getMinutes();
      if (m >= ini && m <= fim) {
        var linha = el('div', 'ga-agora');
        linha.style.top = (TOPO + ((m - ini) / PASSO) * ROW) + 'px';
        col.appendChild(linha);
      }
    }
    return col;
  }

  function desenharProfs() {
    var box = $('ga-profs');
    box.replaceChildren();
    if (ehProf()) { box.hidden = true; return; }
    box.hidden = false;
    ativos().forEach(function (p) {
      var b = el('button', 'ga-chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(est.sel.indexOf(p.id) >= 0));
      b.appendChild(avatar(p));
      b.appendChild(el('span', null, p.nome || ''));
      b.addEventListener('click', function () {
        if (est.modo === 'semana') est.sel = [p.id];
        else {
          var i = est.sel.indexOf(p.id);
          if (i >= 0) { if (est.sel.length > 1) est.sel.splice(i, 1); }
          else {
            est.sel.push(p.id);
            var cap = capacidadeDia();
            if (est.sel.length > cap) est.sel = est.sel.slice(-cap);
          }
        }
        guardarSelecao();
        desenhar();
      });
      box.appendChild(b);
    });
  }

  function desenharDias(cols) {
    var box = $('ga-dias');
    var precisa = est.modo === 'dia' || cols.cortou > 0;
    box.hidden = !precisa;
    if (!precisa) return;
    box.replaceChildren();
    var seg = segunda(paraData(est.data));
    var hojeISO = iso(new Date());
    for (var i = 0; i < 6; i++) {
      (function (d) {
        var di = iso(d);
        var tem = est.sel.some(function (id) { return eventos(id, di).length > 0; });
        var b = el('button', 'ga-dia' + (tem ? ' tem' : '') + (di === hojeISO ? ' hoje' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(di === est.data));
        b.appendChild(el('small', null, DIAS[(d.getDay() + 6) % 7]));
        b.appendChild(el('b', null, String(d.getDate())));
        b.appendChild(el('i'));
        b.setAttribute('aria-label', DIAS_LONGO[d.getDay()] + ', ' + rotuloData(d) + (tem ? ', com atendimentos' : ''));
        b.addEventListener('click', function () { irPara(di); });
        box.appendChild(b);
      })(somar(seg, i));
    }
  }

  // ---------- ações ----------
  function sincronizarCampoData() {
    var campo = $('filtro-data-agenda');
    if (campo) campo.value = est.data;
  }
  function irPara(dataISO) {
    est.data = ajustarDomingo(dataISO, 1);
    est.rolar = true;
    sincronizarCampoData();
    render(false);
  }
  function andar(dir) {
    var cols = colunas();
    var d = paraData(est.data);
    if (est.modo === 'semana' && cols.cortou === 0) d = somar(d, 7 * dir);
    else { d = somar(d, dir); if (d.getDay() === 0) d = somar(d, dir); }
    irPara(iso(d));
  }
  function trocarModo(modo) {
    est.modo = modo === 'dia' ? 'dia' : 'semana';
    guardar(K_MODO, est.modo);
    if (!est.pronto) { render(false); return; }
    if (est.modo === 'semana') est.sel = [est.sel[0]].filter(Boolean);
    est.rolar = true;
    ajustarSelecao();
    guardarSelecao();
    desenhar();
  }

  function novoAgendamento(dataISO, profId, horario) {
    if (!ehAdmin()) return;
    var campo = $('filtro-data-agenda');
    if (campo) campo.value = dataISO || est.data;
    if (profId) guardar(K_PROF, profId);
    App.abrirMarcar(horario || undefined);
    var sel = $('agendamento-profissional');
    var alvo = profId || est.sel[0];
    if (sel && alvo) sel.value = alvo;
    try { App.aplicarHorariosLivres(); } catch (e) { /* opcional */ }
  }

  function cliquePainel(ev) {
    var cd = ev.target.closest('.ga-cab-dia');
    if (cd && cd.dataset.dia) {
      est.data = ajustarDomingo(cd.dataset.dia, 1);
      sincronizarCampoData();
      est.rolar = true;
      trocarModo('dia');
      return;
    }
    var fx = ev.target.closest('.ga-fechado');
    if (fx && fx._bloqueio) { if (ehAdmin()) janelaReabrir(fx._bloqueio); return; }
    var b = ev.target.closest('.ga-bloco');
    if (b && b._ag) { janelaDetalhe(b._ag); return; }
    var col = ev.target.closest('.ga-col');
    if (col && ehAdmin()) {
      var r = col.getBoundingClientRect();
      var y = ev.clientY - r.top - TOPO;
      var m = est.faixaIni + Math.max(0, Math.floor(y / css('--ga-row', 44))) * PASSO;
      m = Math.min(m, est.faixaFim - PASSO);
      novoAgendamento(col.dataset.data, col.dataset.prof, hh(m));
    }
  }

  // ---------- janelas ----------
  function abrirJanela(titulo) {
    var d = $('ga-dlg-in');
    d.replaceChildren();
    d.appendChild(el('h3', null, titulo));
    return d;
  }
  function fecharJanela() { var d = $('ga-dlg'); if (d.open) d.close(); }
  function acao(txt, cls, fn) {
    var b = el('button', 'ga-btn' + (cls ? ' ' + cls : ''), txt);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function linhas(d, pares) {
    var dl = el('dl');
    pares.forEach(function (l) { if (l[1] == null || l[1] === '') return; dl.appendChild(el('dt', null, l[0])); dl.appendChild(el('dd', null, l[1])); });
    d.appendChild(dl);
  }

  function janelaDetalhe(a) {
    var d = abrirJanela(a.cliente || 'Atendimento');
    var t = inicioFim(a), st = statusDe(a);
    var p = profPorId(a.profissional_id);
    var pares = [
      ['Serviço', a.servico], ['Horário', hh(t[0]) + ' – ' + hh(t[1])],
      ['Data', rotuloData(paraData(String(a.data).slice(0, 10)))],
      ['Situação', STATUS[st]], ['Profissional', p ? p.nome : ''], ['Valor', grana(a.valor)]
    ];
    if (ehProf() && p) {
      var pct = parseFloat(p.comissao_pct);
      if (!isFinite(pct)) pct = 50;
      pares.push(['Sua comissão', grana((parseFloat(a.valor) || 0) * pct / 100) + ' (' + pct + '%)']);
    }
    if (a.observacao) pares.push(['Observação', a.observacao]);
    linhas(d, pares);

    if (ehAdmin()) {
      var sts = el('div', 'ga-dlg-acoes');
      ORDEM_STATUS.forEach(function (s) {
        var b = acao(STATUS[s], '', function () { fecharJanela(); App.mudarStatusAgendamento(a.id, s); });
        b.setAttribute('aria-pressed', String(s === st));
        sts.appendChild(b);
      });
      d.appendChild(sts);
      var outras = el('div', 'ga-dlg-acoes');
      outras.appendChild(acao('Adicionar dentro', 'ok', function () { fecharJanela(); App.abrirEncaixe(a); }));
      outras.appendChild(acao('Desmarcar', 'perigo', function () { fecharJanela(); App.excluirAgendamento(a.id, a.cliente); }));
      d.appendChild(outras);
    }
    var fim = el('div', 'ga-dlg-acoes');
    fim.appendChild(acao('Fechar', '', fecharJanela));
    d.appendChild(fim);
    $('ga-dlg').showModal();
  }

  function janelaFechar() {
    if (!ehAdmin()) return;
    var d = abrirJanela('Fechar horário');
    var dt = paraData(est.data);
    d.appendChild(el('p', 'ga-aviso', DIAS_LONGO[dt.getDay()] + ', ' + rotuloData(dt)));

    var lbEsc = el('label', null, 'Para quem');
    var esc = el('select');
    var p0 = profPorId(est.sel[0]);
    var o1 = el('option', null, 'Toda a equipe'); o1.value = ''; esc.appendChild(o1);
    if (p0) { var o2 = el('option', null, p0.nome || ''); o2.value = p0.id; esc.appendChild(o2); esc.value = p0.id; }
    lbEsc.appendChild(esc); d.appendChild(lbEsc);

    var lbTipo = el('label', null, 'O que fechar');
    var tipo = el('select');
    [['dia', 'O dia inteiro'], ['intervalo', 'Só um intervalo']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; tipo.appendChild(op);
    });
    lbTipo.appendChild(tipo); d.appendChild(lbTipo);

    var par = el('div', 'ga-dlg-par'); par.hidden = true;
    var lbDe = el('label', null, 'De'); var de = el('input'); de.type = 'time'; de.step = 1800; de.value = '12:00'; lbDe.appendChild(de);
    var lbAte = el('label', null, 'Até'); var ate = el('input'); ate.type = 'time'; ate.step = 1800; ate.value = '13:00'; lbAte.appendChild(ate);
    par.appendChild(lbDe); par.appendChild(lbAte); d.appendChild(par);
    tipo.addEventListener('change', function () { par.hidden = tipo.value !== 'intervalo'; });

    var lbMot = el('label', null, 'Motivo'); var mot = el('input'); mot.type = 'text'; mot.maxLength = 80; mot.placeholder = 'Ex.: almoço, folga, feriado'; lbMot.appendChild(mot);
    d.appendChild(lbMot);

    var ac = el('div', 'ga-dlg-acoes');
    ac.appendChild(acao('Fechar horário', 'principal', async function () {
      var reg = { data: est.data, motivo: mot.value.trim() || 'Fechado', profissional_id: esc.value || null };
      if (tipo.value === 'intervalo') {
        if (!de.value || !ate.value || ate.value <= de.value) { UI.showToast('Escolha o horário de início e de fim.', 'error'); return; }
        reg.hora_inicio = de.value; reg.hora_fim = ate.value;
      }
      try {
        reg.estabelecimento_id = await App.obterEstabId();
        var r = await supabaseClient.from('bloqueios').insert([reg]);
        if (r.error) throw r.error;
        fecharJanela();
        UI.showToast('Horário fechado.');
        render(true);
      } catch (e) { UI.showToast(mensagemAmigavel(e), 'error'); }
    }));
    ac.appendChild(acao('Cancelar', '', fecharJanela));
    d.appendChild(ac);
    $('ga-dlg').showModal();
  }

  function janelaReabrir(b) {
    var d = abrirJanela(b.motivo || 'Fechado');
    linhas(d, [
      ['Data', rotuloData(paraData(String(b.data).slice(0, 10)))],
      ['Horário', b.hora_inicio ? hhmm(b.hora_inicio) + ' – ' + hhmm(b.hora_fim) : 'Dia inteiro'],
      ['Vale para', b.profissional_id ? ((profPorId(b.profissional_id) || {}).nome || 'Profissional') : 'Toda a equipe']
    ]);
    var ac = el('div', 'ga-dlg-acoes');
    ac.appendChild(acao('Reabrir', 'ok', async function () {
      try {
        var q = supabaseClient.from('bloqueios').delete();
        if (b.id) q = q.eq('id', b.id);
        else {
          q = q.eq('estabelecimento_id', await App.obterEstabId()).eq('data', String(b.data).slice(0, 10));
          q = b.profissional_id ? q.eq('profissional_id', b.profissional_id) : q.is('profissional_id', null);
          q = b.hora_inicio ? q.eq('hora_inicio', b.hora_inicio) : q.is('hora_inicio', null);
        }
        var r = await q;
        if (r.error) throw r.error;
        fecharJanela();
        UI.showToast('Horário reaberto.');
        render(true);
      } catch (e) { UI.showToast(mensagemAmigavel(e), 'error'); }
    }));
    ac.appendChild(acao('Fechar', '', fecharJanela));
    d.appendChild(ac);
    $('ga-dlg').showModal();
  }

  // ---------- estatísticas do profissional (cards da área dele) ----------
  function atualizarResumoProfissional() {
    if (!ehProf()) return;
    var p = profPorId(App.user.id);
    var pct = p ? parseFloat(p.comissao_pct) : NaN;
    if (!isFinite(pct)) pct = 50;
    var doDia = est.ags.filter(function (a) { return a.profissional_id === App.user.id && String(a.data).slice(0, 10) === est.data; });
    var total = doDia.reduce(function (s, a) { return s + (parseFloat(a.valor) || 0); }, 0);
    var elAt = $('prof-stat-atendimentos') || $('hc-prof-total');
    if (elAt) elAt.textContent = doDia.length;
    var elCom = $('prof-stat-comissao') || $('hc-prof-comissao');
    if (elCom) elCom.textContent = grana(total * pct / 100);
  }

  // ---------- ciclo ----------
  async function render(forcar) {
    if (!montar()) return;
    if (est.carregando) { est.pendente = true; return; }
    est.carregando = true;
    try {
      if (!est.data) {
        var campo = $('filtro-data-agenda');
        est.data = ajustarDomingo((campo && campo.value) || iso(new Date()), 1);
      } else {
        var c = $('filtro-data-agenda');
        if (c && c.value && c.value !== est.data) est.data = ajustarDomingo(c.value, 1);
      }
      sincronizarCampoData();
      if (!est.modo) est.modo = ler(K_MODO) === 'dia' ? 'dia' : (ler(K_MODO) === 'semana' ? 'semana' : (window.innerWidth < 720 ? 'dia' : 'semana'));
      var ok = await carregar(!!forcar);
      if (!ok) return;
      if (!est.sel.length) {
        try { est.sel = JSON.parse(ler(K_SEL) || '[]'); } catch (e) { est.sel = []; }
        if (!Array.isArray(est.sel)) est.sel = [];
      }
      ajustarSelecao();
      if (est.modo === 'semana') est.sel = est.sel.slice(0, 1);
      est.pronto = true;
      desenhar();
      atualizarResumoProfissional();
    } catch (e) {
      console.error('Agenda:', e);
      if (raiz && $('ga-painel')) {
        var p = $('ga-painel');
        p.replaceChildren(el('div', 'ga-vazio', 'Não consegui carregar a agenda. ' + (typeof mensagemAmigavel === 'function' ? mensagemAmigavel(e) : '')));
      }
    } finally {
      est.carregando = false;
      if (est.pendente) { est.pendente = false; render(true); }
    }
  }

  return {
    render: render,
    irPara: irPara,
    trocarModo: trocarModo,
    estado: function () { return est; }
  };
})();
window.Agenda = Agenda;
