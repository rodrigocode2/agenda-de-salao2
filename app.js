// CONEXÃO COM O SUPABASE
const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g2JwYEFICtNivZWjZTzWm_XZHAU';

let tempFotoBase64 = '';

const Auth = {
    user: { loggedIn: false, role: '', name: '' },

    async initAuth() {
        // Verifica se o usuário retornou de um login social (Google/Facebook)
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            const email = session.user.email;
            const name = session.user.user_metadata ? .full_name || email.split('@')[0];
            this.user = { loggedIn: true, role: 'admin', name: name };
            this.finishLogin(`Bem-vindo, ${name}!`);
        }

        // Ouve mudanças de estado de autenticação
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const email = session.user.email;
                const name = session.user.user_metadata ? .full_name || email.split('@')[0];
                this.user = { loggedIn: true, role: 'admin', name: name };
                this.finishLogin(`Bem-vindo, ${name}!`);
            }
        });
    },

    loginAdmin(e) {
        e.preventDefault();
        const email = document.getElementById('login-admin-email').value;
        this.user = { loggedIn: true, role: 'admin', name: email.split('@')[0] };
        this.finishLogin("Bem-vindo, Dono do Salão!");
    },

    async loginSocial(provider) {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: provider, // 'google' ou 'facebook'
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) {
            UI.toast("Erro ao conectar com " + provider + ": " + error.message, "error");
        }
    },

    async loginProfissional(e) {
        e.preventDefault();
        const cpfInput = document.getElementById('login-prof-id').value;
        const senhaInput = document.getElementById('login-prof-senha').value;

        const { data: profs, error } = await supabaseClient.from('profissionais').select('*').eq('cpf', cpfInput).eq('senha', senhaInput);

        if (error || !profs || profs.length === 0) {
            return UI.toast("CPF ou senha incorretos!", "error");
        }

        const encontrado = profs[0];
        this.user = { loggedIn: true, role: 'profissional', name: encontrado.nome };
        this.finishLogin(`Bem-vindo, ${encontrado.nome}!`);
    },

    finishLogin(msg) {
        const header = document.getElementById('main-header');
        if (header) header.classList.remove('hidden');
        UI.applyPermissions();
        UI.toast(msg);
        UI.switchTab('aba3');
    },

    async logout() {
        await supabaseClient.auth.signOut();
        this.user = { loggedIn: false, role: '', name: '' };
        document.getElementById('main-header').classList.add('hidden');
        UI.switchTab('aba-login');
        UI.toast("Sessão encerrada.");
    }
};

const UI = {
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
        const target = document.getElementById(tabId);
        if (target) target.classList.remove('hidden');

        if (tabId === 'aba3') App.renderAgendaGrid();
        if (tabId === 'aba4') App.populateProfissionaisSelect();
        if (tabId === 'aba5') App.renderProfissionaisGestao();
    },

    applyPermissions() {
        const isAdmin = Auth.user.role === 'admin';
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isAdmin ? 'inline-flex' : 'none';
        });

        const nameDisp = document.getElementById('user-name-display');
        const roleDisp = document.getElementById('user-role-display');
        if (nameDisp) nameDisp.innerText = Auth.user.name;
        if (roleDisp) roleDisp.innerText = isAdmin ? 'Estabelecimento' : 'Profissional';
    },

    toast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const t = document.createElement('div');
        t.className = `p-4 rounded-xl border ${type === 'error' ? 'bg-rose-950 border-rose-800 text-rose-200' : 'bg-zinc-900 border-white/20 text-white'} shadow-2xl text-xs uppercase font-bold`;
        t.innerText = msg;
        container.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }
};

const App = {
        HORARIOS: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"],

        init() {
            const hoje = new Date().toISOString().split('T')[0];
            const filtroData = document.getElementById('filtro-data-agenda');
            const agendamentoData = document.getElementById('agendamento-data');
            if (filtroData) filtroData.value = hoje;
            if (agendamentoData) agendamentoData.value = hoje;

            this.populateHorariosSelect();
            this.initHeroTrail();

            // Iniciar verificação de autenticação social
            Auth.initAuth();

            // Deixar o vídeo em câmera lenta (50% da velocidade)
            const heroVideo = document.getElementById('hero-video');
            if (heroVideo) {
                heroVideo.playbackRate = 0.5;
            }
        },

        initHeroTrail() {
            const heroSection = document.getElementById('aba-login');
            if (!heroSection) return;

            heroSection.addEventListener('mousemove', (e) => {
                const rect = heroSection.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const dot = document.createElement('div');
                dot.className = 'trail-dot';
                dot.style.left = `${x}px`;
                dot.style.top = `${y}px`;
                heroSection.appendChild(dot);

                setTimeout(() => {
                    dot.style.transform = 'translate(-50%, -50%) scale(0.2)';
                    dot.style.opacity = '0';
                }, 60);

                setTimeout(() => {
                    dot.remove();
                }, 500);
            });
        },

        handleFotoUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                tempFotoBase64 = evt.target.result;
                const img = document.getElementById('preview-foto-prof');
                if (img) {
                    img.src = tempFotoBase64;
                    img.classList.remove('hidden');
                }
                const icon = document.getElementById('icon-foto-prof');
                if (icon) icon.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        },

        setPlan(tipo) {
            UI.toast(`Plano ${tipo.toUpperCase()} selecionado!`);
            UI.switchTab('aba3');
        },

        populateHorariosSelect() {
            const select = document.getElementById('agendamento-horario');
            if (select) {
                select.innerHTML = this.HORARIOS.map(h => `<option value="${h}">${h}</option>`).join('');
            }
        },

        async populateProfissionaisSelect() {
            const { data: profs } = await supabaseClient.from('profissionais').select('*');
            const select = document.getElementById('agendamento-profissional');
            if (profs && select) {
                select.innerHTML = profs.map(p => `<option value="${p.id}">${p.nome} (${p.cargo})</option>`).join('');
            }
        },

        async handleCreateProfissional(e) {
            e.preventDefault();

            const novo = {
                nome: document.getElementById('prof-nome').value,
                cargo: document.getElementById('prof-cargo').value,
                cpf: document.getElementById('prof-cpf').value,
                rg: document.getElementById('prof-rg').value,
                certificado: document.getElementById('prof-certificado').value,
                senha: document.getElementById('prof-senha').value,
                foto: tempFotoBase64
            };

            const { error } = await supabaseClient.from('profissionais').insert([novo]);

            if (error) {
                return UI.toast("Erro ao cadastrar: CPF já existente ou erro de conexão.", "error");
            }

            UI.toast("Profissional cadastrado no banco!");
            e.target.reset();
            tempFotoBase64 = '';
            const img = document.getElementById('preview-foto-prof');
            if (img) img.classList.add('hidden');
            const icon = document.getElementById('icon-foto-prof');
            if (icon) icon.classList.remove('hidden');

            this.renderProfissionaisGestao();
        },

        async handleCreateAgendamento(e) {
            e.preventDefault();
            if (Auth.user.role !== 'admin') return UI.toast("Apenas o estabelecimento pode agendar.", "error");

            const novoAgendamento = {
                data: document.getElementById('agendamento-data').value,
                profissional_id: document.getElementById('agendamento-profissional').value,
                horario: document.getElementById('agendamento-horario').value,
                cliente: document.getElementById('cliente-nome').value,
                servico: document.getElementById('cliente-servico').value
            };

            const { error } = await supabaseClient.from('agendamentos').insert([novoAgendamento]);

            if (error) {
                return UI.toast("Erro ao agendar horário.", "error");
            }

            UI.toast("Agendamento gravado na nuvem!");
            UI.switchTab('aba3');
        },

        async renderAgendaGrid() {
            const dataInput = document.getElementById('filtro-data-agenda');
            if (!dataInput) return;
            const dataSel = dataInput.value;

            const { data: profs } = await supabaseClient.from('profissionais').select('*');
            const { data: agendamentos } = await supabaseClient.from('agendamentos').select('*').eq('data', dataSel);

            const headerRow = document.getElementById('grid-header-row');
            if (!headerRow) return;
            headerRow.innerHTML = '<th class="py-3 px-4 w-24 sticky-time-col">Horário</th>';

            const tbody = document.getElementById('grid-horarios-body');
            if (!tbody) return;

            if (!profs || profs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-zinc-500">Nenhum profissional cadastrado.</td></tr>';
                return;
            }

            profs.forEach(p => {
                        headerRow.innerHTML += `
        <th class="py-3 px-4 text-white font-bold">
          <div class="flex items-center gap-2">
            ${p.foto ? `<img src="${p.foto}" class="w-6 h-6 rounded-full object-cover">` : '<i class="fa-solid fa-circle-user text-zinc-500"></i>'}
            <div>
              <div>${p.nome}</div>
              <span class="block text-[9px] text-zinc-500 font-normal">${p.cargo}</span>
            </div>
          </div>
        </th>`;
        });

        tbody.innerHTML = '';

        this.HORARIOS.forEach(h => {
            let tr = `<tr><td class="py-3.5 px-4 font-bold text-zinc-400 sticky-time-col">${h}</td>`;
            profs.forEach(p => {
                const ag = agendamentos ? agendamentos.find(a => a.profissional_id === p.id && a.horario === h) : null;
                if (ag) {
                    tr += `<td class="py-3 px-4"><div class="bg-brand-500/10 border border-brand-500/30 p-2 rounded-xl"><span class="font-bold text-white uppercase block text-[11px]">${ag.cliente}</span><span class="text-[10px] text-zinc-400">${ag.servico}</span></div></td>`;
                } else {
                    tr += `<td class="py-3 px-4 text-zinc-700 uppercase text-[10px]">Livre</td>`;
                }
            });
            tr += '</tr>';
            tbody.innerHTML += tr;
        });
    },

    async renderProfissionaisGestao() {
        const { data: profs } = await supabaseClient.from('profissionais').select('*');
        const container = document.getElementById('lista-profissionais');
        if (!container) return;

        if (!profs || profs.length === 0) {
            container.innerHTML = '<p class="text-xs text-zinc-500">Nenhum profissional cadastrado no banco.</p>';
            return;
        }

        const badge = document.getElementById('limite-profissionais-badge');
        if (badge) badge.innerText = `${profs.length} Cadastrados`;

        container.innerHTML = profs.map(p => `
      <div class="bg-zinc-950 border border-white/10 p-4 rounded-2xl flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          ${p.foto ? `<img src="${p.foto}" class="w-full h-full object-cover">` : '<i class="fa-solid fa-user text-zinc-600"></i>'}
        </div>
        <div class="flex-grow space-y-0.5">
          <h4 class="font-bold text-white text-xs uppercase">${p.nome}</h4>
          <p class="text-[10px] text-brand-500 font-semibold">${p.cargo}</p>
          <div class="text-[9px] text-zinc-500">CPF: ${p.cpf} | RG: ${p.rg}</div>
          ${p.certificado ? `<div class="text-[9px] text-zinc-400">Certificado: ${p.certificado}</div>` : ''}
        </div>
      </div>
    `).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());