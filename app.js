const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHRjbm9zemxxdHJmY2NmanhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NTA0MDEsImV4cCI6MjEwNjEyNjQwMX0.wJVZhvkvilggyf6yGe8F6e8Szs1E4hjD6fNGJpOlR7I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Auth = {
  user: { loggedIn: false, role: '', name: '' },

  async initAuth() {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      
      if (session && session.user) {
        const email = session.user.email || '';
        const name = session.user.user_metadata?.full_name || (email ? email.split('@')[0] : 'Utilizador');
        this.user = { loggedIn: true, role: 'admin', name };
        this.finishLogin(`Bem-vindo, ${name}!`);
      }
    } catch (e) {
      console.error("Erro na inicialização da autenticação:", e);
    }
  },

  async loginSocial(provider) {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) alert('Erro no login social: ' + error.message);
    } catch (e) { 
      console.error(e); 
    }
  },

  async loginAdmin(event) {
    event.preventDefault();
    const email = document.getElementById('login-admin-email')?.value;
    const senha = document.getElementById('login-admin-senha')?.value;
    if (!email || !senha) {
      alert('Preencha o e-mail e a senha.');
      return;
    }
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
    const cpf = document.getElementById('login-prof-id')?.value;
    const senha = document.getElementById('login-prof-senha')?.value;
    try {
      const { data, error } = await supabaseClient.from('profissionais').select('*').eq('cpf', cpf).eq('senha', senha).single();
      if (error || !data) { alert('CPF ou senha incorretos.'); return; }
      this.user = { loggedIn: true, role: 'profissional', name: data.nome };
      this.finishLogin(`Bem-vindo, ${data.nome}!`);
    } catch (e) { alert('Erro ao validar login.'); }
  },

  finishLogin(msg) {
    if (msg) console.log(msg);
    document.getElementById('aba-login')?.classList.add('hidden');
    document.getElementById('main-header')?.classList.remove('hidden');
    
    const nameDisplay = document.getElementById('user-name-display');
    const roleDisplay = document.getElementById('user-role-display');
    if (nameDisplay) nameDisplay.textContent = this.user.name;
    if (roleDisplay) roleDisplay.textContent = this.user.role.toUpperCase();

    UI.switchTab('aba3');
    App.init();
  },

  logout() {
    supabaseClient.auth.signOut();
    this.user = { loggedIn: false, role: '', name: '' };
    document.getElementById('main-header')?.classList.add('hidden');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('aba-login')?.classList.remove('hidden');
  }
};

const UI = {
  switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId)?.classList.remove('hidden');
    if (tabId === 'aba3') App.renderAgendaGrid();
    if (tabId === 'aba5') App.renderListaProfissionais();
  }
};

const App = {
  fotoBase64Temp: '',

  async init() {
    const filtroData = document.getElementById('filtro-data-agenda');
    if (filtroData && !filtroData.value) filtroData.valueAsDate = new Date();
    await this.carregarSelects();
    this.renderAgendaGrid();
    this.renderListaProfissionais();
  },

  setPlan(plan) {
    alert('Plano ' + plan + ' selecionado. Integre o seu link de pagamento.');
  },

  async carregarSelects() {
    const selectProf = document.getElementById('agendamento-profissional');
    const selectHorario = document.getElementById('agendamento-horario');

    try {
      const { data: profissionais } = await supabaseClient.from('profissionais').select('*');

      if (selectProf) {
        selectProf.innerHTML = '<option value="">Selecione o Profissional</option>';
        profissionais?.forEach(p => selectProf.innerHTML += `<option value="${p.nome}">${p.nome}</option>`);
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
        body.innerHTML = `<tr><td class="py-4 px-4 text-zinc-300" colspan="2">Nenhum profissional cadastrado. Vá à aba 'Equipe'.</td></tr>`;
        return;
      }

      headerRow.innerHTML = `<th class="py-3 px-4 w-24 sticky-time-col bg-zinc-950/70 text-white backdrop-blur-sm">Horário</th>` +
        profissionais.map(p => `<th class="py-3 px-4 text-white uppercase">${p.nome}<br><span class="text-[10px] text-brand-500 font-normal">${p.cargo || ''}</span></th>`).join('');

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
        let linha = `<tr class="border-b border-white/10"><td class="py-3 px-4 font-bold text-brand-500 bg-zinc-950/30 backdrop-blur-sm">${hora}</td>`;
        profissionais.forEach((prof, pIdx) => {
          if (skipMatrix[pIdx][hIdx]) return;
          const ag = agendamentosMapeados[`${pIdx}-${hIdx}`];
          if (ag) {
            linha += `<td rowspan="${ag.blocos}" class="py-3 px-4 bg-brand-500/25 border-l border-white/15 align-top shadow-inner backdrop-blur-md">
              <span class="inline-block px-2 py-0.5 rounded bg-brand-500/30 text-brand-200 text-[10px] font-bold uppercase">Atendimento</span>
              <p class="font-extrabold text-white text-xs mt-1">${ag.cliente_nome}</p>
              <p class="text-[11px] text-brand-300 font-medium">${ag.servico}</p>
              </td>`;
          } else {
            linha += `<td class="py-3 px-4 text-zinc-400 border-l border-white/10 hover:bg-white/10 cursor-pointer transition" onclick="App.preencherAgendamento('${hora}', '${prof.nome}')">+ Disponível</td>`;
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
    const duracao_minutos = 30;
    const cliente_nome = document.getElementById('cliente-nome').value;
    const servico = document.getElementById('cliente-servico').value;

    try {
      const { error } = await supabaseClient.from('agendamentos').insert([{ data, profissional, horario, duracao_minutos, cliente_nome, servico }]);
      if (error) throw error;
      alert('Agendamento efetuado com sucesso!');
      e.target.reset();
      UI.switchTab('aba3');
    } catch (err) { alert('Erro ao agendar: ' + err.message); }
  },

  handleFotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvt) => {
      this.fotoBase64Temp = uploadEvt.target.result;
      const preview = document.getElementById('preview-foto-prof');
      const icon = document.getElementById('icon-foto-prof');
      if (preview) {
        preview.src = this.fotoBase64Temp;
        preview.classList.remove('hidden');
      }
      if (icon) icon.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  },

  async handleCreateProfissional(e) {
    e.preventDefault();
    const { data: profs } = await supabaseClient.from('profissionais').select('id');
    if (profs && profs.length >= 2) {
      alert('Limite do plano gratuito atingido (2 profissionais).');
      UI.switchTab('aba2');
      return;
    }

    const nome = document.getElementById('prof-nome').value;
    const cargo = document.getElementById('prof-cargo').value;
    const cpf = document.getElementById('prof-cpf').value;
    const rg = document.getElementById('prof-rg').value;
    const certificado = document.getElementById('prof-certificado').value;
    const senha = document.getElementById('prof-senha').value;
    const foto = this.fotoBase64Temp;

    try {
      const { error } = await supabaseClient.from('profissionais').insert([{ nome, cargo, cpf, rg, certificado, senha, foto }]);
      if (error) throw error;
      
      alert('Profissional cadastrado com sucesso!');
      e.target.reset();
      this.fotoBase64Temp = '';
      const preview = document.getElementById('preview-foto-prof');
      const icon = document.getElementById('icon-foto-prof');
      if (preview) { preview.src = ''; preview.classList.add('hidden'); }
      if (icon) icon.classList.remove('hidden');

      this.renderListaProfissionais();
      this.carregarSelects();
    } catch (err) { alert('Erro ao guardar profissional: ' + err.message); }
  },

  async renderListaProfissionais() {
    const lista = document.getElementById('lista-profissionais');
    const badge = document.getElementById('limite-profissionais-badge');
    if (!lista) return;
    try {
      const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
      if (badge) {
        badge.textContent = `${profissionais?.length || 0} / 2 Profissionais (Plano Gratuito)`;
      }
      lista.innerHTML = profissionais?.map(p => `
        <div class="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/85 border border-white/10 backdrop-blur-md">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
              ${p.foto ? `<img src="${p.foto}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user text-zinc-500"></i>`}
            </div>
            <div>
              <h4 class="text-xs font-bold text-white uppercase">${p.nome}</h4>
              <p class="text-[10px] text-brand-500 font-medium">${p.cargo} — CPF: ${p.cpf}</p>
              ${p.certificado ? `<p class="text-[9px] text-zinc-400">Cert: ${p.certificado}</p>` : ''}
            </div>
          </div>
        </div>
      `).join('') || '<p class="text-xs text-zinc-500">Nenhum profissional cadastrado.</p>';
    } catch (e) { console.error(e); }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  Auth.initAuth();
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      const email = session.user.email || '';
      const name = session.user.user_metadata?.full_name || (email ? email.split('@')[0] : 'Utilizador');
      Auth.user = { loggedIn: true, role: 'admin', name };
      Auth.finishLogin(`Bem-vindo, ${name}!`);
    }
  });
});
