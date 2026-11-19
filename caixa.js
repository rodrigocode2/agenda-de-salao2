/* =========================================================
   Comanda e Caixa - HairConcept
   - App.abrirComanda(agendamento): fecha o atendimento (servico + produtos,
     desconto, forma de pagamento), lanca a entrada no caixa, baixa o estoque
     e marca o agendamento como finalizado.
   - App.renderCaixa(): aba Caixa (entradas, saidas, total por forma de
     pagamento e lancamentos avulsos).
   Depende de app.js (App, UI, Auth, supabaseClient, dataLocalISO).
   ========================================================= */
(function () {
  'use strict';

  var FORMAS = { dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Cartão de débito', credito: 'Cartão de crédito', outro: 'Outro' };
  var comanda = { ag: null, itens: [], produtos: [], prof: null };

  function $(id) { return document.getElementById(id); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function grana(v) { return 'R$ ' + (Math.round(num(v) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function hojeISO() { return (typeof dataLocalISO === 'function') ? dataLocalISO(new Date()) : new Date().toISOString().slice(0, 10); }
  function aviso(t, tipo) { try { UI.showToast(t, tipo); } catch (e) { alert(t); } }
  function erro(e) { try { return mensagemAmigavel(e); } catch (x) { return 'Não foi possível concluir agora.'; } }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function formaSelect(id) {
    var s = el('select', 'w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white');
    s.id = id;
    Object.keys(FORMAS).forEach(function (k) { var o = el('option', null, FORMAS[k]); o.value = k; s.appendChild(o); });
    return s;
  }
  function campo(rotulo, input) {
    var d = el('div');
    d.appendChild(el('label', 'block text-xs uppercase font-bold text-zinc-400 mb-1', rotulo));
    d.appendChild(input);
    return d;
  }

  // ---------------- COMANDA ----------------
  function totais() {
    var valorServ = num($('cmd-valor') && $('cmd-valor').value);
    var prod = comanda.itens.reduce(function (s, i) { return s + i.qtd * i.preco; }, 0);
    var desc = Math.min(num($('cmd-desconto') && $('cmd-desconto').value), valorServ + prod);
    return { servico: valorServ, produtos: prod, desconto: Math.max(desc, 0), total: Math.max(valorServ + prod - Math.max(desc, 0), 0) };
  }

  function atualizarTotal() {
    var t = totais();
    var c = $('cmd-total');
    if (c) c.textContent = grana(t.total);
    var lista = $('cmd-itens');
    if (!lista) return;
    lista.innerHTML = '';
    comanda.itens.forEach(function (i, idx) {
      var l = el('div', 'flex items-center justify-between gap-2 text-[11px] text-zinc-300');
      l.appendChild(el('span', null, i.qtd + 'x ' + i.nome + ' — ' + grana(i.qtd * i.preco)));
      var x = el('button', 'text-rose-400 hover:text-rose-300 cursor-pointer', 'Remover');
      x.type = 'button';
      x.onclick = function () { comanda.itens.splice(idx, 1); atualizarTotal(); };
      l.appendChild(x);
      lista.appendChild(l);
    });
  }

  async function abrirComanda(ag) {
    if (!ag || !ag.id) return;
    var corpo = $('comanda-corpo');
    if (!corpo) return;
    comanda = { ag: ag, itens: [], produtos: [], prof: null };
    corpo.innerHTML = '';
    corpo.appendChild(el('p', 'text-xs text-zinc-400', 'Carregando...'));
    Auth.abrirModal('modal-comanda');

    var estabId = await App.obterEstabId();
    try {
      var r = await supabaseClient.from('produtos').select('id, nome, preco_venda, stock, tipo')
        .eq('estabelecimento_id', estabId).order('nome', { ascending: true });
      comanda.produtos = (r.data || []).filter(function (p) { return (p.tipo || 'venda') === 'venda' && (p.stock || 0) > 0; });
      if (ag.profissional_id) {
        var pr = await supabaseClient.from('profissionais').select('id, nome, comissao_produtos').eq('id', ag.profissional_id).maybeSingle();
        comanda.prof = pr.data || null;
      }
      var ja = await supabaseClient.from('transacoes_caixa').select('id').eq('agendamento_id', ag.id).maybeSingle();
      if (ja.data) { corpo.innerHTML = ''; corpo.appendChild(el('p', 'text-xs text-emerald-400 font-bold', 'Este atendimento já foi recebido no caixa.')); return; }
    } catch (e) { console.warn('Comanda:', e); }

    corpo.innerHTML = '';
    corpo.appendChild(el('p', 'text-sm font-bold text-white uppercase', ag.cliente || 'Cliente'));
    corpo.appendChild(el('p', 'text-[11px] text-zinc-400 mb-3', [ag.servico, ag.profissional_nome].filter(Boolean).join(' • ')));

    var valor = el('input', 'w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white');
    valor.id = 'cmd-valor'; valor.type = 'number'; valor.step = '0.01'; valor.min = '0';
    valor.value = String(num(ag.valor));
    valor.oninput = atualizarTotal;
    corpo.appendChild(campo('Valor do serviço (R$)', valor));

    // produtos
    var linha = el('div', 'flex gap-2 items-end mt-3');
    var sel = el('select', 'flex-1 glass-input rounded-xl px-3 py-2.5 text-xs text-white');
    sel.id = 'cmd-produto';
    var o0 = el('option', null, comanda.produtos.length ? 'Adicionar produto...' : 'Sem produtos em estoque'); o0.value = '';
    sel.appendChild(o0);
    comanda.produtos.forEach(function (p) { var o = el('option', null, p.nome + ' — ' + grana(p.preco_venda) + ' (' + p.stock + ')'); o.value = String(p.id); sel.appendChild(o); });
    var qtd = el('input', 'w-16 glass-input rounded-xl px-2 py-2.5 text-xs text-white');
    qtd.id = 'cmd-qtd'; qtd.type = 'number'; qtd.min = '1'; qtd.value = '1';
    var add = el('button', 'px-3 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-200 text-xs font-bold uppercase cursor-pointer', 'Incluir');
    add.type = 'button';
    add.onclick = function () {
      var p = comanda.produtos.filter(function (x) { return String(x.id) === sel.value; })[0];
      var q = Math.max(parseInt(qtd.value, 10) || 1, 1);
      if (!p) return;
      var existente = comanda.itens.filter(function (i) { return i.id === p.id; })[0];
      var total = (existente ? existente.qtd : 0) + q;
      if (total > p.stock) { aviso('Só tem ' + p.stock + ' no estoque.', 'error'); return; }
      if (existente) existente.qtd = total; else comanda.itens.push({ id: p.id, nome: p.nome, preco: num(p.preco_venda), qtd: q });
      sel.value = ''; qtd.value = '1';
      atualizarTotal();
    };
    linha.appendChild(sel); linha.appendChild(qtd); linha.appendChild(add);
    corpo.appendChild(linha);
    corpo.appendChild(Object.assign(el('div', 'space-y-1 mt-2'), { id: 'cmd-itens' }));

    var desc = el('input', 'w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white');
    desc.id = 'cmd-desconto'; desc.type = 'number'; desc.step = '0.01'; desc.min = '0'; desc.value = '0';
    desc.oninput = atualizarTotal;
    var g = el('div', 'grid grid-cols-2 gap-3 mt-3');
    g.appendChild(campo('Desconto (R$)', desc));
    g.appendChild(campo('Forma de pagamento', formaSelect('cmd-forma')));
    corpo.appendChild(g);

    var tot = el('div', 'flex items-center justify-between mt-4 pt-3 border-t border-white/10');
    tot.appendChild(el('span', 'text-xs uppercase font-bold text-zinc-400', 'Total a receber'));
    var tv = el('span', 'text-lg font-black text-brand-500', 'R$ 0,00'); tv.id = 'cmd-total';
    tot.appendChild(tv);
    corpo.appendChild(tot);

    var ok = el('button', 'w-full mt-4 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer', 'Receber e finalizar');
    ok.type = 'button'; ok.id = 'cmd-ok';
    ok.onclick = finalizarComanda;
    corpo.appendChild(ok);
    atualizarTotal();
  }

  async function finalizarComanda() {
    var ag = comanda.ag; if (!ag) return;
    var btn = $('cmd-ok'); if (btn) btn.disabled = true;
    var t = totais();
    var forma = $('cmd-forma').value;
    var estabId = await App.obterEstabId();
    var hoje = hojeISO();
    try {
      var desc = (ag.cliente || 'Cliente') + (ag.servico ? ' - ' + ag.servico : '') + (comanda.itens.length ? ' + produtos' : '');
      var ins = await supabaseClient.from('transacoes_caixa').insert([{
        estabelecimento_id: estabId, tipo: 'entrada', descricao: desc.slice(0, 200), valor: t.total,
        data_transacao: hoje, forma_pagamento: forma, agendamento_id: ag.id, profissional_id: ag.profissional_id || null
      }]);
      if (ins.error) {
        if (String(ins.error.code) === '23505') aviso('Este atendimento já foi recebido.', 'error');
        else aviso(erro(ins.error), 'error');
        if (btn) btn.disabled = false;
        return;
      }
      await supabaseClient.from('agendamentos').update({ status: 'finalizado', valor: t.servico }).eq('id', ag.id);

      var pct = num(comanda.prof && comanda.prof.comissao_produtos);
      for (var i = 0; i < comanda.itens.length; i++) {
        var it = comanda.itens[i];
        var bruto = it.qtd * it.preco;
        await supabaseClient.from('vendas_produtos').insert([{
          estabelecimento_id: estabId, produto_id: it.id, produto_nome: it.nome,
          profissional_id: ag.profissional_id || null, profissional_nome: ag.profissional_nome || (comanda.prof && comanda.prof.nome) || '',
          quantidade: it.qtd, valor_total: bruto, comissao_valor: Math.round(bruto * pct) / 100,
          data_venda: hoje, cliente_nome: ag.cliente || null
        }]);
        var p = comanda.produtos.filter(function (x) { return x.id === it.id; })[0];
        if (p) await supabaseClient.from('produtos').update({ stock: Math.max((p.stock || 0) - it.qtd, 0) }).eq('id', it.id);
      }
      Auth.fecharModal('modal-comanda');
      aviso('Recebido: ' + grana(t.total) + ' (' + FORMAS[forma] + ')');
      try { if (window.Agenda && Agenda.render) Agenda.render(true); else App.renderAgendaGrid(); } catch (e) {}
      try { App.renderCaixa(); } catch (e) {}
    } catch (e) {
      console.error('Erro ao finalizar a comanda:', e);
      aviso('Não consegui receber agora. Tente de novo.', 'error');
      if (btn) btn.disabled = false;
    }
  }

  // ---------------- CAIXA ----------------
  async function renderCaixa() {
    var lista = $('caixa-lista'); if (!lista) return;
    var inpData = $('caixa-data');
    if (inpData && !inpData.value) inpData.value = hojeISO();
    var dia = (inpData && inpData.value) || hojeISO();
    var estabId = await App.obterEstabId();
    if (!estabId) { lista.textContent = 'Não encontrei o seu salão. Recarregue a página.'; return; }
    var r = await supabaseClient.from('transacoes_caixa').select('*')
      .eq('estabelecimento_id', estabId).eq('data_transacao', dia).order('created_at', { ascending: false });
    if (r.error) { lista.textContent = 'Não foi possível carregar o caixa agora.'; return; }
    var dados = r.data || [];
    var ent = 0, sai = 0, porForma = {};
    dados.forEach(function (x) {
      var v = num(x.valor);
      if (x.tipo === 'entrada') { ent += v; var f = x.forma_pagamento || 'outro'; porForma[f] = (porForma[f] || 0) + v; } else sai += v;
    });
    $('caixa-entradas').textContent = grana(ent);
    $('caixa-saidas').textContent = grana(sai);
    $('caixa-saldo').textContent = grana(ent - sai);
    var pf = $('caixa-formas'); pf.innerHTML = '';
    Object.keys(porForma).forEach(function (k) {
      pf.appendChild(el('span', 'px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-[10px] text-zinc-300', (FORMAS[k] || k) + ': ' + grana(porForma[k])));
    });
    lista.innerHTML = '';
    if (!dados.length) { lista.appendChild(el('p', 'text-xs text-zinc-500', 'Nenhum lançamento neste dia.')); return; }
    dados.forEach(function (x) {
      var l = el('div', 'flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950 border border-white/10');
      var e = el('div');
      e.appendChild(el('p', 'text-xs text-white font-bold', x.descricao));
      e.appendChild(el('p', 'text-[10px] text-zinc-500', (x.tipo === 'entrada' ? 'Entrada' : 'Saída') + (x.forma_pagamento ? ' • ' + (FORMAS[x.forma_pagamento] || x.forma_pagamento) : '')));
      l.appendChild(e);
      var d = el('div', 'flex items-center gap-3');
      d.appendChild(el('span', 'text-xs font-bold ' + (x.tipo === 'entrada' ? 'text-emerald-400' : 'text-rose-400'), (x.tipo === 'entrada' ? '+ ' : '- ') + grana(x.valor)));
      var del = el('button', 'text-[10px] text-zinc-500 hover:text-rose-400 uppercase font-bold cursor-pointer', 'Excluir');
      del.type = 'button';
      del.onclick = async function () {
        if (!confirm('Excluir este lançamento?')) return;
        var q = await supabaseClient.from('transacoes_caixa').delete().eq('id', x.id);
        if (q.error) { aviso(erro(q.error), 'error'); return; }
        renderCaixa();
      };
      d.appendChild(del);
      l.appendChild(d);
      lista.appendChild(l);
    });
  }

  async function lancarCaixa(event) {
    if (event && event.preventDefault) event.preventDefault();
    var tipo = $('caixa-tipo').value;
    var descricao = $('caixa-desc').value.trim();
    var valor = num($('caixa-valor').value);
    if (!descricao || valor <= 0) { aviso('Escreva a descrição e um valor maior que zero.', 'error'); return; }
    var estabId = await App.obterEstabId();
    var q = await supabaseClient.from('transacoes_caixa').insert([{
      estabelecimento_id: estabId, tipo: tipo, descricao: descricao, valor: valor,
      data_transacao: ($('caixa-data') && $('caixa-data').value) || hojeISO(), forma_pagamento: $('caixa-forma').value
    }]);
    if (q.error) { aviso(erro(q.error), 'error'); return; }
    $('caixa-desc').value = ''; $('caixa-valor').value = '';
    aviso('Lançamento salvo.');
    renderCaixa();
  }

  function montarFormaAvulsa() {
    var host = $('caixa-forma-host');
    if (host && !$('caixa-forma')) host.appendChild(formaSelect('caixa-forma'));
  }

  App.abrirComanda = abrirComanda;
  App.renderCaixa = function () { montarFormaAvulsa(); return renderCaixa(); };
  App.lancarCaixa = lancarCaixa;
})();
