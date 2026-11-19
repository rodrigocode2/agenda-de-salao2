/* Pagina publica de agendamento: o cliente escolhe servico, profissional,
   dia e horario. Fala com o banco so por funcoes publicas (public_salao,
   public_ocupados, public_agendar) - nunca le as tabelas direto. */
(function () {
  'use strict';
  var URL_SB = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
  var KEY = 'sb_publishable_g2JwYeFICTnivZWJZTzWmg_XzHAUm3Z';
  var sb = window.supabase.createClient(URL_SB, KEY);
  var codigo = (new URLSearchParams(location.search).get('s') || '').trim();
  var corpo = document.getElementById('ag-corpo');
  var salao = null, sel = { servico: null, prof: null, data: null, hora: null }, DURACAO = 60, PASSO = 30;

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function min(t) { var p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); }
  function hhmm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function grana(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function grupo(titulo, id) {
    var d = el('section', 'ag-passo'); d.id = id;
    d.appendChild(el('h2', null, titulo));
    var o = el('div', 'ag-opcoes'); d.appendChild(o);
    return { raiz: d, opcoes: o };
  }
  function botao(texto, sub, ativo, fn) {
    var b = el('button', 'ag-op', texto); b.type = 'button';
    if (sub) b.appendChild(el('small', null, sub));
    b.setAttribute('aria-pressed', String(!!ativo));
    b.onclick = fn;
    return b;
  }

  function desenhar() {
    corpo.innerHTML = '';
    var gs = grupo('1. Serviço', 'g-serv');
    salao.servicos.forEach(function (s) {
      gs.opcoes.appendChild(botao(s.nome, grana(s.preco), sel.servico === s.nome, function () { sel.servico = s.nome; sel.hora = null; desenhar(); }));
    });
    corpo.appendChild(gs.raiz);

    var gp = grupo('2. Profissional', 'g-prof');
    salao.profissionais.forEach(function (p) {
      gp.opcoes.appendChild(botao(p.nome, p.cargo, sel.prof === p.id, function () { sel.prof = p.id; sel.hora = null; desenhar(); }));
    });
    corpo.appendChild(gp.raiz);

    var gd = grupo('3. Dia', 'g-dia');
    var hoje = new Date();
    for (var i = 0; i < 14; i++) {
      (function (d) {
        var v = iso(d);
        var rot = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
        gd.opcoes.appendChild(botao(rot, '', sel.data === v, function () { sel.data = v; sel.hora = null; desenhar(); }));
      })(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i));
    }
    corpo.appendChild(gd.raiz);

    var gh = grupo('4. Horário', 'g-hora');
    corpo.appendChild(gh.raiz);
    if (sel.servico && sel.prof && sel.data) carregarHorarios(gh);
    else gh.opcoes.appendChild(el('p', 'ag-sub', 'Escolha serviço, profissional e dia.'));

    var f = el('section', 'ag-passo');
    f.appendChild(el('h2', null, '5. Seus dados'));
    var nome = el('input'); nome.id = 'ag-nome'; nome.placeholder = 'Seu nome'; nome.autocomplete = 'name'; nome.maxLength = 80;
    var tel = el('input'); tel.id = 'ag-tel'; tel.placeholder = 'Seu WhatsApp com DDD'; tel.type = 'tel'; tel.autocomplete = 'tel'; tel.maxLength = 16;
    f.appendChild(nome); f.appendChild(tel);
    var ok = el('button', 'ag-ok', 'Confirmar horário'); ok.type = 'button'; ok.onclick = function () { confirmar(ok); };
    f.appendChild(ok);
    var er = el('p', 'ag-erro'); er.id = 'ag-erro'; f.appendChild(er);
    corpo.appendChild(f);
  }

  async function carregarHorarios(gh) {
    gh.opcoes.appendChild(el('p', 'ag-sub', 'Buscando horários...'));
    var r = await sb.rpc('public_ocupados', { p_codigo: codigo, p_prof: sel.prof, p_data: sel.data });
    gh.opcoes.innerHTML = '';
    var oc = (r.data || []).map(function (x) { return [min(x.inicio), min(x.fim)]; });
    var ini = min(salao.abertura || '08:00'), fim = min(salao.fechamento || '19:00');
    var agora = new Date(), ehHoje = sel.data === iso(agora), nowMin = agora.getHours() * 60 + agora.getMinutes();
    var n = 0;
    for (var m = ini; m + DURACAO <= fim; m += PASSO) {
      if (ehHoje && m <= nowMin) continue;
      var livre = oc.every(function (o) { return !(m < o[1] && m + DURACAO > o[0]); });
      if (!livre) continue;
      (function (hm) {
        gh.opcoes.appendChild(botao(hhmm(hm), '', sel.hora === hhmm(hm), function () {
          sel.hora = hhmm(hm);
          gh.opcoes.querySelectorAll('.ag-op').forEach(function (b) { b.setAttribute('aria-pressed', String(b.firstChild.nodeValue === sel.hora)); });
        }));
      })(m); n++;
    }
    if (!n) gh.opcoes.appendChild(el('p', 'ag-sub', 'Sem horários livres neste dia. Escolha outro dia.'));
  }

  async function confirmar(btn) {
    var er = document.getElementById('ag-erro'); er.textContent = '';
    var nome = document.getElementById('ag-nome').value.trim(), tel = document.getElementById('ag-tel').value.trim();
    if (!sel.servico || !sel.prof || !sel.data || !sel.hora) { er.textContent = 'Escolha serviço, profissional, dia e horário.'; return; }
    if (nome.length < 2 || tel.replace(/\D/g, '').length < 10) { er.textContent = 'Informe seu nome e WhatsApp com DDD.'; return; }
    btn.disabled = true;
    var r = await sb.rpc('public_agendar', { p_codigo: codigo, p_prof: sel.prof, p_data: sel.data, p_horario: sel.hora, p_servico: sel.servico, p_nome: nome, p_telefone: tel });
    var res = r.data;
    if (r.error || !res || !res.ok) { er.textContent = (res && res.erro) || 'Não foi possível agendar agora. Tente de novo.'; btn.disabled = false; if (res) desenhar(); return; }
    sucesso(nome);
  }

  function sucesso(nome) {
    corpo.innerHTML = '';
    var d = el('div', 'ag-sucesso');
    d.appendChild(el('h2', null, 'Horário marcado!'));
    var prof = salao.profissionais.filter(function (p) { return p.id === sel.prof; })[0];
    d.appendChild(el('p', 'ag-sub', sel.servico + (prof ? ' com ' + prof.nome : '') + ' em ' + sel.data.split('-').reverse().join('/') + ' às ' + sel.hora + '.'));
    d.appendChild(el('p', 'ag-sub', 'Até lá, ' + nome.split(' ')[0] + '!'));
    if (salao.whatsapp) {
      var a = el('a', null, 'Avisar o salão no WhatsApp');
      var tx = 'Olá! Agendei ' + sel.servico + ' para ' + sel.data.split('-').reverse().join('/') + ' às ' + sel.hora + ' (' + nome + ').';
      var dg = String(salao.whatsapp).replace(/\D/g, ''); if (dg.length <= 11) dg = '55' + dg;
      a.href = 'https://wa.me/' + dg + '?text=' + encodeURIComponent(tx); a.target = '_blank'; a.rel = 'noopener';
      d.appendChild(a);
    }
    corpo.appendChild(d);
  }

  async function iniciar() {
    if (!codigo) { corpo.textContent = 'Link inválido. Peça o link atualizado ao salão.'; return; }
    var r = await sb.rpc('public_salao', { p_codigo: codigo });
    if (r.error || !r.data) { corpo.textContent = 'Salão não encontrado. Peça o link atualizado ao salão.'; return; }
    salao = r.data;
    document.title = 'Agende em ' + salao.nome;
    document.getElementById('ag-salao').textContent = salao.nome;
    if (!salao.servicos.length || !salao.profissionais.length) { corpo.textContent = 'Este salão ainda não liberou a agenda online.'; return; }
    desenhar();
  }
  iniciar();
})();
