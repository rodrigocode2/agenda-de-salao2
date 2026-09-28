const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHRjbm9zemxxdHJmY2NmanhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NTA0MDEsImV4cCI6MjEwNjEyNjQwMX0.wJVZhvkvilggyf6yGe8F6e8Szs1E4hjD6fNGJpOlR7I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Auth = {
  user: { loggedIn: false, role: '', name: '' },

  async initAuth() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        const email = session.user.email;
        const name = session.user.user_metadata?.full_name || email.split('@')[0];
        this.user = { loggedIn: true, role: 'admin', name };
        this.finishLogin(`Bem-vindo, ${name}!`);
      }
    } catch (e) {
      console.error(e);
    }
  },

  async loginSocial(provider) {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({ provider });
      if (error) alert('Erro no login social: ' + error.message);
    } catch (e) { console.error(e); }
  },

  async loginAdmin(event) {
    event.preventDefault();
    const email = document.getElementById('login-admin-email').value;
    const senha = document.getElementById('login-admin-senha').value;
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
      if (error) { alert('Erro: ' + error.message); return; }
      const name = data.session.user.user_metadata?.full_name || email.split('@')[0];
      this.user = { loggedIn: true, role: 'admin', name };
      this.finishLogin(`Bem-vindo, ${name}!`);
    } catch (e) { alert('Erro crítico: ' + e.message); }
  },

  async loginProfissional(event) {
    event.preventDefault();
    const cpf = document.getElementById('login-prof-id').value;
    const senha = document.getElementById('login-prof-senha').value;
    try {
      const { data, error } = await supabaseClient.from('profissionais').select('*').eq('cpf', cpf).eq('senha', senha).single();
      if (error || !data) { alert('CPF ou senha incorretos.'); return; }
      this.user = { loggedIn: true, role: 'profissional', name: data.nome };
      this.finishLogin(`Bem-vindo, ${data.nome}!`);
    } catch (e) { alert('Erro ao validar login.'); }
  },

  finishLogin(msg) {
    alert(msg);
    document.getElementById('aba-login')?.classList.add('hidden');
    document.getElementById('main-header')?.classList.remove('hidden');
    UI.switchTab('aba3');
    App.init();
  },

  logout() {
    supabaseClient.auth.signOut();
    this.user = { loggedIn: false, role: '', name: '' };
    document.getElementById('main-header')?.classList.add('hidden');
    document.getElementById('aba-login')?.classList.remove('hidden');
    UI.switchTab('aba-login');
  }
};

const UI = {
  switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId)?.classList.remove('hidden');
    if (tabId === 'aba3') App.renderAgendaGrid();
    if (tabId === 'aba5') App.renderListaProfissionais();
    if (tabId === 'aba-produtos') App.renderListaProdutos();
  }
};

const App = {
  async init() {
    const filtroData = document.getElementById('filtro-data-agenda');
    if (filtroData && !filtroData.value) filtroData.valueAsDate = new Date();
    await this.carregarSelects();
    this.renderAgendaGrid();
    this.renderListaProfissionais();
    this.renderListaProdutos();
    this.verificarAlertasValidade();
  },

  setPlan(plan) {
    alert('Plano ' + plan + ' selecionado. Integre o seu link de pagamento da Vercel/Stripe/Mercado Pago.');
  },

  async carregarSelects() {
    const selectProf = document.getElementById('agendamento-profissional');
    const selectVendaProf = document.getElementById('venda-profissional-select');
    const selectProd = document.getElementById('venda-produto-select');
    const selectHorario = document.getElementById('agendamento-horario');

    try {
      const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
      const { data: produtos } = await supabaseClient.from('produtos').select('*');

      if (selectProf) {
        selectProf.innerHTML = '<option value="">Selecione o Profissional</option>';
        profissionais?.forEach(p => selectProf.innerHTML += `<option value="${p.nome}">${p.nome}</option>`);
      }
      if (selectVendaProf) {
        selectVendaProf.innerHTML = '<option value="">Quem vendeu?</option>';
        profissionais?.forEach(p => selectVendaProf.innerHTML += `<option value="${p.nome}">${p.nome} (${p.comissao_pct || 10}% comissão)</option>`);
      }
      if (selectProd) {
        selectProd.innerHTML = '<option value="">Selecione o Produto</option>';
        produtos?.forEach(pr => selectProd.innerHTML += `<option value="${pr.id}" data-preco="${pr.preco_venda}">${pr.nome} - R$ ${pr.preco_venda} (Stock: ${pr.stock})</option>`);
      }
      if (selectHorario) {
        selectHorario.innerHTML = '<option value="">Selecione o Horário</option>';
        for (let h = 8; h < 18; h++) {
          selectHorario.innerHTML += `<option value="${String(h).padStart(2, '0')}:00">${String(h).padStart(2, '0')}:00</option>`;
          selectHorario.innerHTML += `<option value="${String(h).padStart(2, '0')}:30">${String(h).padStart(2, '0')}:30</option>`;
        }
      }
    } catch (e) { console.error(e); }
  },

  async handleCreateProduto(e) {
    e.preventDefault();
    const nome = document.getElementById('prod-nome').value;
    const preco_custo = parseFloat(document.getElementById('prod-custo').value);
    const preco_venda = parseFloat(document.getElementById('prod-venda').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    const data_validade = document.getElementById('prod-validade').value;

    try {
      const { error } = await supabaseClient.from('produtos').insert([{ nome, preco_custo, preco_venda, stock, data_validade }]);
      if (error) throw error;
      alert('Produto cadastrado com sucesso!');
      e.target.reset();
      this.renderListaProdutos();
      this.carregarSelects();
    } catch (err) { alert('Erro ao cadastrar produto: ' + err.message); }
  },

  async handleVenderProduto(e) {
    e.preventDefault();
    const produtoId = document.getElementById('venda-produto-select').value;
    const profissionalNome = document.getElementById('venda-profissional-select').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value);

    try {
      // Buscar dados do produto e do profissional
      const { data: produto } = await supabaseClient.from('produtos').select('*').eq('id', produtoId).single();
      const { data: prof } = await supabaseClient.from('profissionais').select('*').eq('nome', profissionalNome).single();

      if (!produto || produto.stock < qtd) {
        alert('Stock insuficiente para esta venda!');
        return;
      }

      const valorTotal = produto.preco_venda * qtd;
      const comissaoPct = prof?.comissao_pct || 10;
      const comissaoValor = (valorTotal * comissaoPct) / 100;

      // Registar Venda
      await supabaseClient.from('vendas_produtos').insert([{
        produto_id: produto.id,
        produto_nome: produto.nome,
        profissional_nome: profissionalNome,
        quantidade: qtd,
        valor_total: valorTotal,
        comissao_valor: comissaoValor
      }]);

      // Atualizar Stock
      await supabaseClient.from('produtos').update({ stock: produto.stock - qtd }).eq('id', produto.id);

      alert(`Venda efetuada com sucesso!\nValor Total: R$ ${valorTotal.toFixed(2)}\nComissão para ${profissionalNome}: R$ ${comissaoValor.toFixed(2)}`);
      e.target.reset();
      this.renderListaProdutos();
    } catch (err) { alert('Erro ao efetuar venda: ' + err.message); }
  },

  async renderListaProdutos() {
    const body = document.getElementById('lista-produtos-body');
    if (!body) return;

    try {
      const { data: produtos } = await supabaseClient.from('produtos').select('*');
      if (!produtos || produtos.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="py-4 text-zinc-500 text-center">Nenhum produto cadastrado.</td></tr>`;
        return;
      }

      const hoje = new Date();
      body.innerHTML = produtos.map(p => {
        const validadeDate = new Date(p.data_validade);
        const diffDias = Math.ceil((validadeDate - hoje) / (1000 * 60 * 60 * 24));
        let estadoHtml = `<span class="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Normal</span>`;

        if (diffDias <= 0) {
          estadoHtml = `<span class="px-2 py-1 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">Expirado!</span>`;
        } else if (diffDias <= 30) {
          estadoHtml = `<span class="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold animate-pulse">⚠️ Perto de vencer (${diffDias}d)</span>`;
        }

        return `
          <tr class="border-b border-white/5">
            <td class="py-3 px-4 font-bold text-white">${p.nome}</td>
            <td class="py-3 px-4 text-zinc-400">R$ ${p.preco_custo.toFixed(2)}</td>
            <td class="py-3 px-4 text-brand-400 font-bold">R$ ${p.preco_venda.toFixed(2)}</td>
            <td class="py-3 px-4 text-white">${p.stock} un.</td>
            <td class="py-3 px-4 text-zinc-300">${new Date(p.data_validade).toLocaleDateString('pt-BR')}</td>
            <td class="py-3 px-4">${estadoHtml}</td>
          </tr>
        `;
      }).join('');
    } catch (e) { console.error(e); }
  },

  async verificarAlertasValidade() {
    const container = document.getElementById('alerta-validade-container');
    if (!container) return;

    try {
      const { data: produtos } = await supabaseClient.from('produtos').select('*');
      if (!produtos) return;

      const hoje = new Date();
      const produtosParaPromocao = produtos.filter(p => {
        const diffDias = Math.ceil((new Date(p.data_validade) - hoje) / (1000 * 60 * 60 * 24));
        return diffDias > 0 && diffDias <= 30;
      });

      if (produtosParaPromocao.length > 0) {
        container.classList.remove('hidden');
        container.innerHTML = `
          <div class="glass-panel p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fa-solid fa-triangle-exclamation text-amber-400 text-xl"></i>
              <div>
                <h4 class="text-xs font-bold text-white uppercase">Alerta de Validade & Promoção</h4>
                <p class="text-[11px] text-zinc-300">Existem ${produtosParaPromocao.length} produto(s) perto de expirar. Hora de fazer promoção para o ${produtosParaPromocao[0].nome}!</p>
              </div>
            </div>
            <button onclick="UI.switchTab('aba-produtos')" class="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-[10px] uppercase">Ver Stock</button>
          </div>
        `;
      } else {
        container.classList.add('hidden');
      }
    } catch (e) { console.error(e); }
  },

  gerarHorarios() {
    const horarios = [];
    for (let hora = 8; hora < 18; hora++) {
      horarios.push(`${String(hora).padStart(2, '0')}:00`);
      horarios.push(`${String(hora).padStart(2, '0')}:30`);
    }
    horarios.push('18:00');
    return horarios;
  },

  horarioParaIndice(horarioStr) {
    return this.gerarHorarios().indexOf(horarioStr);
  },

  async renderAgendaGrid() {
    const headerRow = document.getElementById('grid-header-row');
    const body = document.getElementById('grid-horarios-body');
    if (!headerRow || !body) return;

    const dataSelecionada = document.getElementById('filtro-data-agenda')?.value || new Date().toISOString().split('T')[0];

    try {
      const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
      if (!profissionais || profissionais.length === 0) {
        headerRow.innerHTML = `<th class="py-3 px-4 w-24">Horário</th>`;
        body.innerHTML = `<tr><td class="py-4 px-4 text-zinc-400">Nenhum profissional cadastrado.</td></tr>`;
        return;
      }

      headerRow.innerHTML = `<th class="py-3 px-4 w-24 sticky-time-col bg-zinc-950 text-white">Horário</th>` +
        profissionais.map(p => `<th class="py-3 px-4 text-white uppercase">${p.nome}<br><span class="text-[10px] text-brand-400 font-normal">${p.cargo || ''}</span></th>`).join('');

      const { data: agendamentos } = await supabaseClient.from('agendamentos').select('*').eq('data', dataSelecionada);

      const horarios = this.gerarHorarios();
      const skipMatrix = {};
      profissionais.forEach((_, pIdx) => { skipMatrix[pIdx] = {}; });
      const agendamentosMapeados = {};

      agendamentos?.forEach(item => {
        const pIdx = profissionais.findIndex(p => p.nome === item.profissional);
        const hIdx = this.horarioParaIndice(item.horario);
        if (pIdx !== -1 && hIdx !== -1) {
          const blocos = Math.ceil((parseInt(item.duracao_minutos) || 30) / 30);
          agendamentosMapeados[`${pIdx}-${hIdx}`] = { ...item, blocos };
          for (let b = 1; b < blocos; b++) skipMatrix[pIdx][hIdx + b] = true;
        }
      });

      body.innerHTML = horarios.map((hora, hIdx) => {
        let linha = `<tr class="border-b border-white/5"><td class="py-3 px-4 font-bold text-brand-400 bg-zinc-950/50">${hora}</td>`;
        profissionais.forEach((prof, pIdx) => {
          if (skipMatrix[pIdx][hIdx]) return;
          const ag = agendamentosMapeados[`${pIdx}-${hIdx}`];
          if (ag) {
            linha += `<td rowspan="${ag.blocos}" class="py-3 px-4 bg-brand-500/15 border-l border-white/10 align-top shadow-inner">
              <span class="inline-block px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-bold uppercase">${ag.duracao_minutos} min</span>
              <p class="font-extrabold text-white text-xs">${ag.cliente_nome}</p>
              <p class="text-[11px] text-brand-400 font-medium">${ag.servico}</p>
            </td>`;
          } else {
            linha += `<td class="py-3 px-4 text-zinc-600 border-l border-white/5 hover:bg-white/5 cursor-pointer transition" onclick="App.preencherAgendamento('${hora}', '${prof.nome}')">+ Disponível</td>`;
          }
        });
        return linha + `</tr>`;
      }).join('');
    } catch (e) { console.error(e); }
  },

  preencherAgendamento(horario, profNome) {
    UI.switchTab('aba4');
    document.getElementById('agendamento-profissional').value = profNome;
    document.getElementById('agendamento-horario').value = horario;
    document.getElementById('agendamento-data').value = document.getElementById('filtro-data-agenda').value;
  },

  async handleCreateAgendamento(e) {
    e.preventDefault();
    const data = document.getElementById('agendamento-data').value;
    const profissional = document.getElementById('agendamento-profissional').value;
    const horario = document.getElementById('agendamento-horario').value;
    const duracao_minutos = parseInt(document.getElementById('agendamento-duracao').value);
    const cliente_nome = document.getElementById('cliente-nome').value;
    const servico = document.getElementById('cliente-servico').value;

    try {
      await supabaseClient.from('agendamentos').insert([{ data, profissional, horario, duracao_minutos, cliente_nome, servico }]);
      alert('Agendamento efetuado com sucesso!');
      e.target.reset();
      UI.switchTab('aba3');
    } catch (err) { alert('Erro ao agendar.'); }
  },

  async handleCreateProfissional(e) {
    e.preventDefault();
    const { data: profs } = await supabaseClient.from('profissionais').select('id');
    if (profs && profs.length >= 2) {
      alert('Limite do plano gratuito atingido (2 profissionais). Assine o plano mensal ou anual.');
      UI.switchTab('aba2');
      return;
    }

    const nome = document.getElementById('prof-nome').value;
    const cargo = document.getElementById('prof-cargo').value;
    const cpf = document.getElementById('prof-cpf').value;
    const comissao_pct = parseFloat(document.getElementById('prof-comissao').value) || 10;
    const senha = document.getElementById('prof-senha').value;

    try {
      await supabaseClient.from('profissionais').insert([{ nome, cargo, cpf, comissao_pct, senha }]);
      alert('Profissional cadastrado com sucesso!');
      e.target.reset();
      this.renderListaProfissionais();
      this.carregarSelects();
    } catch (err) { alert('Erro ao guardar profissional.'); }
  },

  async renderListaProfissionais() {
    const lista = document.getElementById('lista-profissionais');
    if (!lista) return;
    try {
      const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
      lista.innerHTML = profissionais?.map(p => `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-white/10">
          <div>
            <h4 class="text-xs font-bold text-white uppercase">${p.nome}</h4>
            <p class="text-[10px] text-brand-400 font-medium">${p.cargo} — Comissão: ${p.comissao_pct || 10}%</p>
          </div>
        </div>
      `).join('') || '<p class="text-xs text-zinc-500">Nenhum profissional.</p>';
    } catch (e) { console.error(e); }
  }
};

document.addEventListener('DOMContentLoaded', () => { Auth.initAuth(); });
