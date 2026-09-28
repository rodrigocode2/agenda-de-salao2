// Configuração do Supabase (HairConcept)
const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g2JwYeFICTnivZWJZTZWmg_XZHAU';

// Inicialização correta do cliente Supabase
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

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const email = session.user.email;
        const name = session.user.user_metadata?.full_name || email.split('@')[0];
        this.user = { loggedIn: true, role: 'admin', name: name };
        this.finishLogin(`Bem-vindo, ${name}!`);
      }
    });
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
        alert('Erro ao entrar: ' + error.message);
        return;
      }
      if (data.session) {
        const name = data.session.user.user_metadata?.full_name || email.split('@')[0];
        this.user = { loggedIn: true, role: 'admin', name };
        this.finishLogin(`Bem-vindo ao Painel, ${name}!`);
      }
    } catch (e) {
      console.error(e);
    }
  },

  async loginProfissional(event) {
    event.preventDefault();
    this.user = { loggedIn: true, role: 'profissional', name: 'Profissional' };
    this.finishLogin('Bem-vindo à sua agenda!');
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
  }
};

const App = {
  init() {
    console.log('App inicializado.');
    const filtroData = document.getElementById('filtro-data-agenda');
    if (filtroData) filtroData.valueAsDate = new Date();
    this.renderAgendaGrid();
  },
  setPlan(plan) {
    alert('Plano selecionado: ' + plan);
  },
  renderAgendaGrid() {
    const body = document.getElementById('grid-horarios-body');
    if (!body) return;
    body.innerHTML = `<tr><td class="py-4 px-4 text-zinc-400" colspan="2">Nenhum agendamento para esta data.</td></tr>`;
  },
  handleCreateAgendamento(e) {
    e.preventDefault();
    alert('Agendamento criado com sucesso!');
  },
  handleCreateProfissional(e) {
    e.preventDefault();
    alert('Profissional cadastrado com sucesso!');
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

// Efeito de Rastro do Rato restrito apenas à secção Hero
function initMouseTrail() {
  const heroSection = document.querySelector('#hero') || document.querySelector('.hero');
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
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
