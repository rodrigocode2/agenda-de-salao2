// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHRjbm9zemxxdHJmY2NmanhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NTA0MDEsImV4cCI6MjEwNjEyNjQwMX0.wJVZhvkvilggyf6yGe8F6e8Szs1E4hjD6fNGJpOlR7I';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ==========================================
// CONTROLADOR DE UI E TOASTS
// ==========================================
const UI = {
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(tabId);
        if (target) target.classList.remove('hidden');
        
        if (tabId === 'aba3') App.renderAgendaGrid();
        if (tabId === 'aba5') App.renderListaProfissionais();
        if (tabId === 'aba-produtos') App.renderProdutos();
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
    user: { loggedIn: false, role: '', name: '' },

    async initAuth() {
        try {
            if (!supabaseClient) return;
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
                options: { redirectTo: window.location.origin }
            });
            if (error) UI.showToast('Erro no login social: ' + error.message, 'error');
        } catch (e) { 
            console.error(e); 
        }
    },

    async loginAdmin(event) {
        event.preventDefault();
        const email = document.getElementById('login-admin-email')?.value;
        const senha = document.getElementById('login-admin-senha')?.value;
        if (!email || !senha) {
            UI.showToast('Preencha o e-mail e a senha.', 'error');
            return;
        }
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
            if (error) { UI.showToast('Erro: ' + error.message, 'error'); return; }
            const name = data.session.user.user_metadata?.full_name || email.split('@')[0];
            this.user = { loggedIn: true, role: 'admin', name };
            this.finishLogin(`Bem-vindo, ${name}!`);
        } catch (e) { UI.showToast('Erro crítico: ' + e.message, 'error'); }
    },

    async loginProfissional(event) {
        event.preventDefault();
        const cpf = document.getElementById('login-prof-id')?.value;
        const senha = document.getElementById('login-prof-senha')?.value;
        try {
            const { data, error } = await supabaseClient.from('profissionais').select('*').eq('cpf', cpf).eq('senha', senha).single();
            if (error || !data) { UI.showToast('CPF ou senha incorretos.', 'error'); return; }
            this.user = { loggedIn: true, role: 'profissional', name: data.nome };
            this.finishLogin(`Bem-vindo, ${data.nome}!`);
        } catch (e) { UI.showToast('Erro ao validar login.', 'error'); }
    },

    finishLogin(msg) {
        if (msg) UI.showToast(msg);
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
        if (supabaseClient) supabaseClient.auth.signOut();
        this.user = { loggedIn: false, role: '', name: '' };
        document.getElementById('main-header')?.classList.add('hidden');
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('aba-login')?.classList.remove('hidden');
        UI.showToast('Sessão encerrada.');
    }
};

// ==========================================
// CONTROLADOR PRINCIPAL DA APLICAÇÃO
// ==========================================
const App = {
    fotoBase64Temp: '',

    async init() {
        const filtroData = document.getElementById('filtro-data-agenda');
        const agendamentoData = document.getElementById('agendamento-data');
        const hojeStr = new Date().toISOString().split('T')[0];
        if (filtroData && !filtroData.value) filtroData.value = hojeStr;
        if (agendamentoData && !agendamentoData.value) agendamentoData.value = hojeStr;
        
        await this.carregarSelects();
        this.renderAgendaGrid();
        this.renderListaProfissionais();
        this.renderProdutos();
    },

    setPlan(plan) {
        localStorage.setItem('hairconcept_plan', plan);

        if (plan === 'gratis') {
            UI.showToast('Plano Gratuito ativo (Limite de 2 profissionais).');
            return;
        }
        
        const linksPagamento = {
            'mensal': 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=SEU_ID_PLANO_MENSAL',
            'anual': 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=SEU_ID_PLANO_ANUAL'
        };

        const link = linksPagamento[plan];
        if (link && !link.includes('SEU_ID')) {
            window.open(link, '_blank');
        } else {
            const nomePlano = plan === 'mensal' ? 'Plano Mensal - Até 10 Profissionais (R$ 30/mês)' : 'Plano Anual - Até 20 Agendas/dia (R$ 300/ano)';
            alert(`A redirecionar para o checkout de ${nomePlano}. Insira os seus links oficiais do Mercado Pago no app.js se desejar links diretos.`);
            window.open('https://www.mercadopago.com.br', '_blank');
        }
    },

    // Gestão de Stock e Alertas de Validade com Notificação de Promoção (< 3 meses)
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
                let alertaPromocaoHtml = '';

                if (isVencido) {
                    badgeStatus = '<span class="px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase border border-rose-500/30">Expirado</span>';
                    cardBorder = 'border-rose-500/40 bg-rose-950/20';
                } else if (isVencendo) {
                    badgeStatus = '<span class="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase border border-amber-500/30">Vence em Breve</span>';
                    cardBorder = 'border-amber-500/40 bg-amber-950/20';
                    alertaPromocaoHtml = `
                        <div class="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-2.5 text-amber-200 text-xs font-semibold animate-pulse">
                            <i class="fa-solid fa-bullhorn text-amber-400 text-base"></i>
                            <span><strong>Atenção:</strong> Está na hora de fazer promoção para não perder seu produto! Falta menos de 3 meses para acabar.</span>
                        </div>
                    `;
                }

                const tipoLabel = p.tipo === 'uso' ? 'Uso Interno' : 'Para Venda';

                return `
                  <div class="flex flex-col p-5 rounded-2xl border ${cardBorder} backdrop-blur-md transition space-y-3 shadow-lg">
                      <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3">
                              <h4 class="text-sm font-bold text-white uppercase">${p.nome}</h4>
                              <span class="px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase border border-white/10">${tipoLabel}</span>
                              ${badgeStatus}
                          </div>
                          <span class="text-xs font-bold text-brand-500">R$ ${Number(p.preco_venda || 0).toFixed(2)}</span>
                      </div>
                      <div class="flex justify-between text-xs text-zinc-300 border-t border-white/5 pt-2">
                          <span>Stock Disponível: <strong class="text-white">${p.stock} un.</strong></span>
                          <span>Data de Validade: <strong class="text-white">${p.data_validade || 'Não informada'}</strong></span>
                      </div>
                      ${alertaPromocaoHtml}
                  </div>
                `;
            }).join('') || '<p class="text-xs text-zinc-500 text-center py-6">Nenhum produto cadastrado no stock.</p>';

            if (badge) {
                badge.textContent = `${totalProximosVencimento} produtos em alerta (3 meses)`;
            }
        } catch (e) {
            console.error("Erro ao carregar produtos:", e);
            lista.innerHTML = '<p class="text-xs text-rose-400 text-center py-4">Erro ao carregar dados do stock.</p>';
        }
    },

    async handleCreateProduto(event) {
        event.preventDefault();
        const nome = document.getElementById('prod-nome').value;
        const tipo = document.getElementById('prod-tipo').value;
        const preco_venda = parseFloat(document.getElementById('prod-preco').value) || 0;
        const stock = parseInt(document.getElementById('prod-stock').value) || 0;
        const data_validade = document.getElementById('prod-validade').value;

        try {
            const { error } = await supabaseClient.from('produtos').insert([{
                nome,
                tipo,
                preco_venda,
                stock,
                data_validade
            }]);

            if (error) throw error;

            UI.showToast('Produto cadastrado com sucesso!');
            event.target.reset();
            this.renderProdutos();
        } catch (e) {
            UI.showToast('Erro ao cadastrar produto: ' + e.message, 'error');
        }
    },

    async carregarSelects() {
        const selectProf = document.getElementById('agendamento-profissional');
        const selectHorario = document.getElementById('agendamento-horario');

        try {
            const { data: profissionais } = await supabaseClient.from('profissionais').select('*');

            if (selectProf) {
                selectProf.innerHTML = '<option value="">Selecione o Profissional</option>';
                profissionais?.forEach(p => selectProf.innerHTML += `<option value="${p.id}">${p.nome} (${p.cargo || ''})</option>`);
            }
            if (selectHorario) {
                selectHorario.innerHTML = '<option value="">Selecione o Horário</option>';
                const horarios = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
                horarios.forEach(h => {
                    selectHorario.innerHTML += `<option value="${h}">${h}</option>`;
                });
            }
        } catch (e) { console.error(e); }
    },

    gerarHorarios() {
        return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
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

            headerRow.innerHTML = `<th class="py-3 px-4 w-28 sticky-time-col bg-zinc-950 font-bold uppercase text-zinc-400 text-xs">Horário</th>` +
                profissionais.map(p => `<th class="py-3 px-4 font-bold uppercase text-white text-xs text-center">${p.nome}</th>`).join('');

            const { data: agendamentos } = await supabaseClient.from('agendamentos').select('*').eq('data', dataSelecionada);

            const horarios = this.gerarHorarios();

            body.innerHTML = horarios.map(hora => {
                let row = `<tr class="hover:bg-white/5 transition"><td class="py-3 px-4 font-mono font-bold text-zinc-300">${hora}</td>`;
                
                profissionais.forEach(prof => {
                    const agendamento = agendamentos?.find(a => a.horario === hora && a.profissional_id === prof.id);
                    if (agendamento) {
                        row += `<td class="py-3 px-4 text-center">
                            <div class="p-2 rounded-xl bg-brand-500/10 border border-brand-500/30 text-[11px] space-y-0.5">
                                <p class="font-bold text-white">${agendamento.cliente}</p>
                                <p class="text-brand-400">${agendamento.servico}</p>
                            </div>
                        </td>`;
                    } else {
                        row += `<td class="py-3 px-4 text-center text-zinc-600 text-[10px] uppercase font-medium cursor-pointer hover:text-white transition" onclick="App.preencherAgendamento('${hora}', '${prof.id}')">Disponível</td>`;
                    }
                });
                row += `</tr>`;
                return row;
            }).join('');
        } catch (e) { console.error(e); }
    },

    preencherAgendamento(horario, profId) {
        UI.switchTab('aba4');
        document.getElementById('agendamento-profissional').value = profId;
        document.getElementById('agendamento-horario').value = horario;
        document.getElementById('agendamento-data').value = document.getElementById('filtro-data-agenda').value;
    },

    async handleCreateAgendamento(e) {
        e.preventDefault();
        const data = document.getElementById('agendamento-data').value;
        const profissional_id = document.getElementById('agendamento-profissional').value;
        const horario = document.getElementById('agendamento-horario').value;
        const cliente = document.getElementById('cliente-nome').value;
        const servico = document.getElementById('cliente-servico').value;
        
        const planoAtual = localStorage.getItem('hairconcept_plan') || 'gratis';

        try {
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
            e.target.reset();
            UI.switchTab('aba3');
            this.renderAgendaGrid();
        } catch (err) { UI.showToast('Erro ao agendar: ' + err.message, 'error'); }
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
            const foto_url = this.fotoBase64Temp;

            const { error } = await supabaseClient.from('profissionais').insert([{ nome, cargo, cpf, rg, certificado, senha, foto_url }]);
            if (error) throw error;
            
            UI.showToast('Profissional cadastrado com sucesso!');
            e.target.reset();
            this.fotoBase64Temp = '';
            const preview = document.getElementById('preview-foto-prof');
            const icon = document.getElementById('icon-foto-prof');
            if (preview) { preview.src = ''; preview.classList.add('hidden'); }
            if (icon) icon.classList.remove('hidden');

            this.renderListaProfissionais();
            this.carregarSelects();
        } catch (err) { UI.showToast('Erro ao cadastrar profissional: ' + err.message, 'error'); }
    },

    async renderListaProfissionais() {
        const lista = document.getElementById('lista-profissionais');
        const badge = document.getElementById('limite-profissionais-badge');
        if (!lista) return;
        try {
            const { data: profissionais } = await supabaseClient.from('profissionais').select('*');
            if (badge) {
                badge.textContent = `${profissionais?.length || 0} cadastrados`;
            }
            lista.innerHTML = profissionais?.map(p => `
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
        } catch (e) { console.error(e); }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    Auth.initAuth();
    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const email = session.user.email || '';
                const name = session.user.user_metadata?.full_name || (email ? email.split('@')[0] : 'Utilizador');
                Auth.user = { loggedIn: true, role: 'admin', name };
                Auth.finishLogin(`Bem-vindo, ${name}!`);
            }
        });
    }
});
