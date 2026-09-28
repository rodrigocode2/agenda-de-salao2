// Configuração do Supabase (HairConcept)
const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHRjbm9zemxxdHJmY2NmanhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NTA0MDEsImV4cCI6MjEwNjEyNjQwMX0.wJVZhvkvilggyf6yGe8F6e8Szs1E4hjD6fNGJpOlR7I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let tempFotoBase64 = '';

const Auth = {
  user: { loggedIn: false, role: '', name: '' },

  async initAuth() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        const email = session.user.email;
        const name = session.user.user_metadata?.full_name || email.split('@')[0];
        this.user = { loggedIn: true, role: 'admin', name: name };
        this.finishLogin(`Bem-vindo, ${name}!`);
      }
    } catch (e) {
      console.error('Erro ao verificar sessão:', e);
    }
  },

  async loginSocial(provider) {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({ provider });
      if (error) alert('Erro no login social: ' + error.message);
    } catch (e) {
      console.error(e);
    }
  },

  async loginAdmin(event) {
    event.preventDefault();
    const email = document.getElementById('login-admin-email').value;
    const senha = document.getElementById('login-admin-senha').value;

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
      if (error) {
        alert('Erro ao entrar no Supabase: ' + error.message);
        return;
      }
      const name = data.session.user.user_metadata?.full_name || email.split('@')[0];
      this.user = { loggedIn: true, role: 'admin', name };
      this.finishLogin(`Bem-vindo ao Painel, ${name}!`);
    } catch (e) {
      alert('Erro crítico no login: ' + e.message);
    }
  },

  async loginProfissional(event) {
    event.preventDefault();
    const cpf = document.getElementById('login-prof-id').value;
    const senha = document.getElementById('login-prof-senha').value;

    try {
      const { data, error } = await supabaseClient
        .from('profissionais')
        .select('*')
        .eq('cpf', cpf)
        .eq('senha', senha)
        .single();

      if (error || !data) {
        alert('CPF ou senha de profissional incorretos.');
        return;
      }

      this.user = { loggedIn: true, role: 'profissional', name: data.nome };
      this.finishLogin(`Bem-vindo à sua agenda, ${data.nome}!`);
    } catch (e) {
      alert('Erro ao validar login do profissional.');
    }
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
  }
};

const App = {
  async init() {
    console.log('App inicializado.');
    const filtroData = document.getElementById('filtro-data-agenda');
    if (filtroData && !filtroData.value) {
      filtroData.valueAsDate = new Date();
    }
    await this.carregarSelectProfissionais();
    this.renderAgendaGrid();
    this.renderListaProfissionais();
  },

  setPlan(plan) {
    alert('Plano selecionado: ' + plan);
  },

  async carregarSelectProfissionais() {
    const select = document.getElementById('agendamento-profissional');
    const selectHorario = document.getElementById('agendamento-horario');
    if (!select) return;

    try {
      const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
      
      select.innerHTML = '<option value="">Selecione o Profissional</option>';
      if (profissionais) {
        profissionais.forEach(p => {
          select.innerHTML += `<option value="${p.nome}">${p.nome} (${p.cargo || 'Profissional'})</option>`;
        });
      }

      if (selectHorario) {
        selectHorario.innerHTML = '<option value="">Selecione o Horário</option>';
        const horarios = this.gerarHorarios();
        horarios.forEach(h => {
          selectHorario.innerHTML += `<option value="${h}">${h}</option>`;
        });
      }
    } catch (e) {
      console.error('Erro ao carregar profissionais:', e);
    }
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
    const horarios = this.gerarHorarios();
    return horarios.indexOf(horarioStr);
  },

  async renderAgendaGrid() {
    const headerRow = document.getElementById('grid-header-row');
    const body = document.getElementById('grid-horarios-body');
    if (!headerRow || !body) return;

    const filtroData = document.getElementById('filtro-data-agenda');
    const dataSelecionada = filtroData ? filtroData.value : new Date().toISOString().split('T')[0];

    try {
      const { data: profissionais, error: errProf } = await supabaseClient.from('profissionais').select('*');
      if (errProf) throw errProf;

      if (!profissionais || profissionais.length === 0) {
        headerRow.innerHTML = `<th class="py-3 px-4 w-24">Horário</th>`;
        body.innerHTML = `<tr><td class="py-4 px-4 text-zinc-400" colspan="1">Nenhum profissional cadastrado. Vá à aba 'Equipe' para cadastrar.</td></tr>`;
        return;
      }

      headerRow.innerHTML = `<th class="py-3 px-4 w-24 sticky-time-col bg-zinc-950 text-white">Horário</th>` +
        profissionais.map(p => `<th class="py-3 px-4 text-white uppercase">${p.nome}<br><span class="text-[10px] text-brand-400 font-normal">${p.cargo || ''}</span></th>`).join('');

      const { data: agendamentos, error: errAgend } = await supabaseClient
        .from('agendamentos')
        .select('*')
        .eq('data', dataSelecionada);

      if (errAgend) throw errAgend;

      const horarios = this.gerarHorarios();
      const skipMatrix = {};
      profissionais.forEach((_, pIdx) => { skipMatrix[pIdx] = {}; });

      const agendamentosMapeados = {};
      if (agendamentos) {
        agendamentos.forEach(item => {
          const pIdx = profissionais.findIndex(p => p.nome === item.profissional || p.id === item.profissional_id);
          const hIdx = this.horarioParaIndice(item.horario);
          if (pIdx !== -1 && hIdx !== -1) {
            const duracaoMin = parseInt(item.duracao_minutos) || 30;
            const blocosOcupados = Math.ceil(duracaoMin / 30);
            
            agendamentosMapeados[`${pIdx}-${hIdx}`] = { ...item, blocosOcupados };

            for (let b = 1; b < blocosOcupados; b++) {
              if (hIdx + b < horarios.length) {
                skipMatrix[pIdx][hIdx + b] = true;
              }
            }
          }
        });
      }

      body.innerHTML = horarios.map((hora, hIdx) => {
        let linhaHtml = `<tr class="border-b border-white/5"><td class="py-3 px-4 font-bold text-brand-400 bg-zinc-950/50">${hora}</td>`;

        profissionais.forEach((prof, pIdx) => {
          if (skipMatrix[pIdx][hIdx]) {
            return;
          }

          const agendamento = agendamentosMapeados[`${pIdx}-${hIdx}`];

          if (agendamento) {
            const rowspanAttr = agendamento.blocosOcupados > 1 ? `rowspan="${agendamento.blocosOcupados}"` : '';
            const horasTexto = `${agendamento.duracao_minutos || 30} min`;
            
            linhaHtml += `<td ${rowspanAttr} class="py-3 px-4 bg-brand-500/15 border-l border-white/10 align-top shadow-inner">
              <div class="space-y-1">
                <span class="inline-block px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-bold uppercase">${horasTexto}</span>
                <p class="font-extrabold text-white text-xs">${agendamento.cliente_nome}</p>
                <p class="text-[11px] text-brand-400 font-medium">${agendamento.servico}</p>
              </div>
            </td>`;
          } else {
            linhaHtml += `<td class="py-3 px-4 text-zinc-600 border-l border-white/5 hover:bg-white/5 cursor-pointer transition" onclick="App.preencherAgendamento('${hora}', '${prof.nome}')" title="Clique para agendar">+ Disponível</td>`;
          }
        });

        linhaHtml += `</tr>`;
        return linhaHtml;
      }).join('');

    } catch (e) {
      console.error('Erro ao renderizar agenda:', e);
      body.innerHTML = `<tr><td class="py-4 px-4 text-red-400" colspan="2">Erro ao carregar os dados da agenda.</td></tr>`;
    }
  },

  preencherAgendamento(horario, profissionalNome) {
    UI.switchTab('aba4');
    const selectProf = document.getElementById('agendamento-profissional');
    const selectHora = document.getElementById('agendamento-horario');
    const inputData = document.getElementById('agendamento-data');
    const filtroData = document.getElementById('filtro-data-agenda');

    if (selectProf) selectProf.value = profissionalNome;
    if (selectHora) selectHora.value = horario;
    if (inputData && filtroData) inputData.value = filtroData.value;
  },

  async handleCreateAgendamento(e) {
    e.preventDefault();
    const data = document.getElementById('agendamento-data').value;
    const profissional = document.getElementById('agendamento-profissional').value;
    const horario = document.getElementById('agendamento-horario').value;
    const duracao_minutos = parseInt(document.getElementById('agendamento-duracao').value) || 30;
    const cliente_nome = document.getElementById('cliente-nome').value;
    const servico = document.getElementById('cliente-servico').value;

    try {
      const { error } = await supabaseClient
        .from('agendamentos')
        .insert([{ data, profissional, horario, duracao_minutos, cliente_nome, servico }]);

      if (error) {
        alert('Erro ao agendar: ' + error.message);
        return;
      }

      alert('Atendimento/Reunião agendado com sucesso e tempo bloqueado na agenda!');
      e.target.reset();
      UI.switchTab('aba3');
    } catch (err) {
      alert('Erro inesperado ao efetuar agendamento.');
    }
  },

  async handleCreateProfissional(e) {
    e.preventDefault();
    const nome = document.getElementById('prof-nome').value;
    const cargo = document.getElementById('prof-cargo').value;
    const cpf = document.getElementById('prof-cpf').value;
    const rg = document.getElementById('prof-rg').value;
    const certificado = document.getElementById('prof-certificado').value;
    const senha = document.getElementById('prof-senha').value;
    const foto = tempFotoBase64;

    try {
      const { error } = await supabaseClient
        .from('profissionais')
        .insert([{ nome, cargo, cpf, rg, certificado, senha, foto }]);

      if (error) {
        alert('Erro ao cadastrar profissional: ' + error.message);
        return;
      }

      alert('Profissional cadastrado com sucesso!');
      e.target.reset();
      tempFotoBase64 = '';
      document.getElementById('preview-foto-prof')?.classList.add('hidden');
      document.getElementById('icon-foto-prof')?.classList.remove('hidden');
      
      this.renderListaProfissionais();
      this.carregarSelectProfissionais();
    } catch (err) {
      alert('Erro ao guardar profissional.');
    }
  },

  async renderListaProfissionais() {
    const lista = document.getElementById('lista-profissionais');
    if (!lista) return;

    try {
      const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
      if (!profissionais || profissionais.length === 0) {
        lista.innerHTML = `<p class="text-xs text-zinc-500">Nenhum profissional cadastrado ainda.</p>`;
        return;
      }

      lista.innerHTML = profissionais.map(p => `
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-zinc-950 border border-white/10">
          <div class="w-12 h-12 rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center shrink-0">
            ${p.foto ? `<img src="${p.foto}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user text-zinc-500"></i>`}
          </div>
          <div>
            <h4 class="text-xs font-bold text-white uppercase">${p.nome}</h4>
            <p class="text-[10px] text-brand-400 font-medium">${p.cargo}</p>
            <p class="text-[9px] text-zinc-500">CPF: ${p.cpf}</p>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  handleFotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
      tempFotoBase64 = uploadEvent.target.result;
      const preview = document.getElementById('preview-foto-prof');
      const icon = document.getElementById('icon-foto-prof');
      if (preview && icon) {
        preview.src = tempFotoBase64;
        preview.classList.remove('hidden');
        icon.classList.add('hidden');
      }
    };
    reader.readAsDataURL(file);
  }
};

function initMouseTrail() {
  const heroSection = document.querySelector('#aba-login');
  if (!heroSection) return;

  heroSection.addEventListener('mousemove', (e) => {
    const trail = document.createElement('div');
    trail.className = 'fixed w-2.5 h-2.5 rounded-full bg-brand-500 pointer-events-none z-50 shadow-[0_0_12px_#ec4899] transition-all duration-300';
    trail.style.left = `${e.clientX}px`;
    trail.style.top = `${e.clientY}px`;
    document.body.appendChild(trail);

    setTimeout(() => {
      trail.style.transform = 'scale(0)';
      trail.style.opacity = '0';
      setTimeout(() => trail.remove(), 300);
    }, 50);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.initAuth();
  initMouseTrail();
});
