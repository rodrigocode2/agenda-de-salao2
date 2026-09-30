// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'SUA_SUPABASE_URL_AQUI';
const SUPABASE_KEY = 'SUA_SUPABASE_ANON_KEY_AQUI';

// Inicialização segura do cliente Supabase
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ==========================================
// CONTROLADOR DE UI E TOASTS
// ==========================================
const UI = {
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(tabId);
        if (target) target.classList.remove('hidden');
        
        if (tabId === 'aba-produtos') {
            App.renderProdutos();
        }
        if (tabId === 'aba3') {
            App.renderAgendaGrid();
        }
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `p-4 rounded-xl text-xs font-bold text-white shadow-2xl transition transform translate-y-0 border ${type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' : 'bg-zinc-950/90 border-emerald-500/40 text-emerald-200'}; backdrop-blur-md`;
        toast.innerHTML = `<div class="flex items-center gap-2"><i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation text-rose-500' : 'fa-circle-check text-emerald-500'}"></i> ${message}</div>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
};

// ==========================================
// CONTROLADOR DE AUTENTICAÇÃO
// ==========================================
const Auth = {
    currentUser: null,
    isAdmin: false,
    
    async loginAdmin(event) {
        event.preventDefault();
        const email = document.getElementById('login-admin-email').value;
        const senha = document.getElementById('login-admin-senha').value;
        
        try {
            if (!supabaseClient) {
                UI.showToast('Supabase não inicializado corretamente.', 'error');
                return;
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
            if (error) {
                UI.showToast('Erro ao entrar: ' + error.message, 'error');
                return;
            }
            Auth.setAdminSession(email, 'Administrador');
        } catch (err) {
            UI.showToast('Erro de autenticação.', 'error');
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
                UI.showToast('CPF ou senha inválidos.', 'error');
                return;
            }
            
            Auth.setProfissionalSession(data);
        } catch (e) {
            UI.showToast('Erro ao fazer login profissional.', 'error');
        }
    },
    
    loginSocial(provider) {
        UI.showToast(`Login social com ${provider} em configuração.`);
    },
    
    setAdminSession(name, role) {
        Auth.isAdmin = true;
        Auth.currentUser = { name, role };
        document.getElementById('aba-login').classList.add('hidden');
        document.getElementById('main-header').classList.remove('hidden');
        document.getElementById('user-name-display').textContent = name;
        document.getElementById('user-role-display').textContent = role;
        document.getElementById('saloon-name-header').textContent = 'Painel de Gestão - Admin';
        
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        UI.switchTab('aba3');
        App.initAdminPanel();
    },
    
    setProfissionalSession(prof) {
        Auth.isAdmin = false;
        Auth.currentUser = prof;
        document.getElementById('aba-login').classList.add('hidden');
        document.getElementById('main-header').classList.remove('hidden');
        document.getElementById('user-name-display').textContent = prof.nome;
        document.getElementById('user-role-display').textContent = prof.cargo || 'Profissional';
        document.getElementById('saloon-name-header').textContent = 'Área do Profissional';
        
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        UI.switchTab('aba3');
        App.renderAgendaGrid();
    },
    
    logout() {
        Auth.currentUser = null;
        Auth.isAdmin = false;
        document.getElementById('main-header').classList.add('hidden');
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('aba-login').classList.remove('hidden');
        UI.showToast('Sessão encerrada.');
    }
};

// ==========================================
// CONTROLADOR PRINCIPAL DA APLICAÇÃO
// ==========================================
const App = {
    async init() {
        const hojeStr = new Date().toISOString().split('T')[0];
        const filtroData = document.getElementById('filtro-data-agenda');
        const agendamentoData = document.getElementById('agendamento-data');
        if (filtroData) filtroData.value = hojeStr;
        if (agendamentoData) agendamentoData.value = hojeStr;
    },
    
    async initAdminPanel() {
        this.renderAgendaGrid();
        this.carregarSelectProfissionais();
        this.renderProfissionaisList();
        this.renderProdutos();
    },

    // 1. Gestão de Planos & Links do Mercado Pago
    setPlan(plan) {
        localStorage.setItem('hairconcept_plan', plan);

        if (plan === 'gratis') {
            UI.showToast('Plano Gratuito ativo (Limite de 2 profissionais).');
            return;
        }
        
        // COLE OS SEUS LINKS REAIS DO MERCADO PAGO AQUI:
        const linksPagamento = {
            'mensal': 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=SEU_ID_PLANO_MENSAL',
            'anual': 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=SEU_ID_PLANO_ANUAL'
        };

        const link = linksPagamento[plan];
        if (link && !link.includes('SEU_ID')) {
            window.open(link, '_blank');
        } else {
            const nomePlano = plan === 'mensal' ? 'Plano Mensal (R$ 30/mês)' : 'Plano Anual - Até 20 Agendas (R$ 300/ano)';
            alert(`A redirecionar para o checkout de ${nomePlano}. Insira os seus links oficiais do Mercado Pago no ficheiro app.js se desejar links diretos.`);
            window.open('https://www.mercadopago.com.br', '_blank');
        }
    },

    // 2. Gestão de Stock e Alertas de Validade (3 Meses / 90 Dias)
    async renderProdutos() {
        const lista = document.getElementById('lista-produtos');
        const badge = document.getElementById('alerta-validade-badge');
        if (!lista) return;

        try {
            const { data: produtos, error } = await supabaseClient.from('produtos').select('*');
            if (error) throw error;

            const hoje = new Date();
            const daquiTresMeses = new Date();
            daquiTresMeses.setMonth(hoje.getMonth() + 3);

            let totalProximosVencimento = 0;

            lista.innerHTML = produtos?.map(p => {
                const dataVal = p.data_validade ? new Date(p.data_validade) : null;
                const isVencendo = dataVal && dataVal <= daquiTresMeses && dataVal >= hoje;
                const isVencido = dataVal && dataVal < hoje;

                if (isVencendo || isVencido) totalProximosVencimento++;

                let badgeStatus = '<span class="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase border border-emerald-500/30">Estável</span>';
                let cardBorder = 'border-white/10 bg-zinc-950/80';

                if (isVencido) {
                    badgeStatus = '<span class="px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase border border-rose-500/30">Expirado</span>';
                    cardBorder = 'border-rose-500/40 bg-rose-950/20';
                } else if (isVencendo) {
                    badgeStatus = '<span class="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase border border-amber-500/30"><i class="fa-solid fa-triangle-exclamation"></i> Promoção Sugerida (Vence em breve)</span>';
                    cardBorder = 'border-amber-500/40 bg-amber-950/20';
                }

                return `
                  <div class="flex items-center justify-between p-4 rounded-2xl border ${cardBorder} backdrop-blur-md transition">
                      <div class="space-y-1">
                          <div class="flex items-center gap-3">
                              <h4 class="text-sm font-bold text-white uppercase">${p.nome}</h4>
                              ${badgeStatus}
                          </div>
                          <p class="text-xs text-zinc-300">Preço de Venda: <span class="font-bold text-brand-500">R$ ${p.preco_venda}</span> | Stock Disponível: <span class="font-bold text-white">${p.stock} un.</span></p>
                          <p class="text-[11px] text-zinc-400"><i class="fa-regular fa-calendar"></i> Data de Validade: <span class="text-white">${p.data_validade || 'Não informada'}</span></p>
                      </div>
                  </div>
                `;
            }).join('') || '<p class="text-xs text-zinc-500 text-center py-6">Nenhum produto cadastrado no stock.</p>';

            if (badge) {
                badge.textContent = `${totalProximosVencimento} produtos em alerta (3 meses)`;
            }
        } catch (e) {
            console.error("Erro ao carregar produtos:", e);
            lista.innerHTML = '<p class="text-xs text-rose-400 text-center py-4">Erro ao carregar dados do stock. Verifique a tabela "produtos" no Supabase.</p>';
        }
    },

    async renderAgendaGrid() {
        const tbody = document.getElementById('grid-horarios-body');
        const headerRow = document.getElementById('grid-header-row');
        const dataFiltro = document.getElementById('filtro-data-agenda')?.value || new Date().toISOString().split('T')[0];
        if (!tbody || !headerRow) return;

        try {
            const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
            const { data: agendamentos } = await supabaseClient.from('agendamentos').select('*').eq('data', dataFiltro);

            let headerHtml = '<th class="py-3 px-4 w-28 sticky-time-col bg-zinc-950 font-bold uppercase text-zinc-400 text-xs">Horário</th>';
            profissionais?.forEach(p => {
                headerHtml += `<th class="py-3 px-4 font-bold uppercase text-white text-xs text-center">${p.nome}</th>`;
            });
            headerRow.innerHTML = headerHtml;

            const horarios = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
            
            tbody.innerHTML = horarios.map(hora => {
                let row = `<tr class="hover:bg-white/5 transition"><td class="py-3 px-4 font-mono font-bold text-zinc-300">${hora}</td>`;
                
                profissionais?.forEach(prof => {
                    const agendamento = agendamentos?.find(a => a.horario === hora && a.profissional_id === prof.id);
                    if (agendamento) {
                        row += `<td class="py-3 px-4 text-center">
                            <div class="p-2 rounded-xl bg-brand-500/10 border border-brand-500/30 text-[11px] space-y-0.5">
                                <p class="font-bold text-white">${agendamento.cliente}</p>
                                <p class="text-brand-400">${agendamento.servico}</p>
                            </div>
                        </td>`;
                    } else {
                        row += `<td class="py-3 px-4 text-center text-zinc-600 text-[10px] uppercase font-medium">Disponível</td>`;
                    }
                });
                row += `</tr>`;
                return row;
            }).join('');
        } catch (e) {
            console.error("Erro ao carregar agenda:", e);
        }
    },

    async carregarSelectProfissionais() {
        const select = document.getElementById('agendamento-profissional');
        if (!select) return;
        try {
            const { data: profs } = await supabaseClient.from('profissionais').select('*');
            select.innerHTML = profs?.map(p => `<option value="${p.id}">${p.nome} (${p.cargo})</option>`).join('') || '';
            
            const horarioSelect = document.getElementById('agendamento-horario');
            if (horarioSelect) {
                const horarios = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
                horarioSelect.innerHTML = horarios.map(h => `<option value="${h}">${h}</option>`).join('');
            }
        } catch (e) {
            console.error("Erro ao carregar select:", e);
        }
    },

    async handleCreateAgendamento(event) {
        event.preventDefault();
        const data = document.getElementById('agendamento-data').value;
        const profissional_id = document.getElementById('agendamento-profissional').value;
        const horario = document.getElementById('agendamento-horario').value;
        const cliente = document.getElementById('cliente-nome').value;
        const servico = document.getElementById('cliente-servico').value;
        
        const planoAtual = localStorage.getItem('hairconcept_plan') || 'gratis';

        try {
            // Verificar limite de agendamentos para o Plano Anual (até 20 agendas por dia)
            const { count, error: countError } = await supabaseClient
                .from('agendamentos')
                .select('*', { count: 'exact', head: true })
                .eq('data', data);

            if (countError) throw countError;

            if (planoAtual === 'anual' && count >= 20) {
                UI.showToast('Limite atingido! O Plano Anual permite no máximo 20 agendas por dia.', 'error');
                return;
            }

            const { error } = await supabaseClient.from('agendamentos').insert([{ data, profissional_id, horario, cliente, servico }]);
            if (error) throw error;
            UI.showToast('Agendamento realizado com sucesso!');
            UI.switchTab('aba3');
            this.renderAgendaGrid();
        } catch (e) {
            UI.showToast('Erro ao agendar: ' + e.message, 'error');
        }
    },

    async handleCreateProfissional(event) {
        event.preventDefault();
        
        const planoAtual = localStorage.getItem('hairconcept_plan') || 'gratis';

        try {
            const { count, error: countError } = await supabaseClient
                .from('profissionais')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            if (planoAtual === 'gratis' && count >= 2) {
                UI.showToast('Limite atingido! O Plano Gratuito permite apenas 2 profissionais. Faça upgrade na aba Planos.', 'error');
                UI.switchTab('aba2');
                return;
            }

            const nome = document.getElementById('prof-nome').value;
            const cargo = document.getElementById('prof-cargo').value;
            const cpf = document.getElementById('prof-cpf').value;
            const rg = document.getElementById('prof-rg').value;
            const certificado = document.getElementById('prof-certificado').value;
            const senha = document.getElementById('prof-senha').value;
            const foto_url = document.getElementById('preview-foto-prof').src || '';

            const { error } = await supabaseClient.from('profissionais').insert([{ nome, cargo, cpf, rg, certificado, senha, foto_url }]);
            if (error) throw error;
            
            UI.showToast('Profissional cadastrado com sucesso!');
            event.target.reset();
            document.getElementById('preview-foto-prof').classList.add('hidden');
            document.getElementById('icon-foto-prof').classList.remove('hidden');
            this.renderProfissionaisList();
        } catch (e) {
            UI.showToast('Erro ao cadastrar profissional: ' + e.message, 'error');
        }
    },

    handleFotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('preview-foto-prof');
            const icon = document.getElementById('icon-foto-prof');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            icon.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    },

    async renderProfissionaisList() {
        const lista = document.getElementById('lista-profissionais');
        const badge = document.getElementById('limite-profissionais-badge');
        if (!lista) return;

        try {
            const { data: profs, error } = await supabaseClient.from('profissionais').select('*');
            if (error) throw error;

            if (badge) badge.textContent = `${profs?.length || 0} cadastrados`;

            lista.innerHTML = profs?.map(p => `
                <div class="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        ${p.foto_url ? `<img src="${p.foto_url}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user text-zinc-600"></i>`}
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-white uppercase">${p.nome}</h4>
                        <p class="text-[11px] text-brand-500">${p.cargo}</p>
                        <p class="text-[10px] text-zinc-500">CPF: ${p.cpf}</p>
                    </div>
                </div>
            `).join('') || '<p class="text-xs text-zinc-500">Nenhum profissional cadastrado.</p>';
        } catch (e) {
            console.error("Erro ao listar profissionais:", e);
        }
    }
};

// Inicialização automática ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
