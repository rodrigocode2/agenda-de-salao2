const SUPABASE_URL = 'https://wahtcnoszlatqtrfcfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHRjbm9zemxhdHF0cmZjZmp4ZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzEwMDAwMDAwLCJleHAiOjIwMjU2MDAwMDB9';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const Auth = {
    async loginAdmin(e) {
        e.preventDefault();
        const email = document.getElementById('login-admin-email').value;
        const senha = document.getElementById('login-admin-senha').value;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
            if (error) throw error;
            const name = data.user.user_metadata?.full_name || email.split('@')[0];
            App.user = { loggedIn: true, role: 'admin', name: name };
            App.finishLogin(`Bem-vindo, ${name}!`);
        } catch (err) {
            UI.showToast('Erro ao entrar: ' + err.message, 'error');
        }
    },

    async loginSocial(provider) {
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({ provider });
            if (error) throw error;
        } catch (err) {
            UI.showToast('Erro no login social: ' + err.message, 'error');
        }
    },

    async loginProfissional(event) {
        event.preventDefault();
        const nomeEstabelecimento = document.getElementById('login-prof-estabelecimento').value.trim();
        const cpf = document.getElementById('login-prof-id').value.trim();
        const senha = document.getElementById('login-prof-senha').value.trim();
        
        try {
            const { data, error } = await supabaseClient
                .from('profissionais')
                .select('*')
                .ilike('estabelecimento', nomeEstabelecimento)
                .eq('cpf', cpf)
                .eq('senha', senha)
                .single();

            if (error || !data) { 
                UI.showToast('Estabelecimento, CPF ou senha incorretos.', 'error'); 
                return; 
            }
            
            if (data.estabelecimento_id) {
                localStorage.setItem('hairconcept_estab_id', data.estabelecimento_id);
            }
            
            App.user = { loggedIn: true, role: 'profissional', name: data.nome };
            
            const headerSub = document.getElementById('saloon-name-header');
            if (headerSub) headerSub.textContent = data.estabelecimento || nomeEstabelecimento;

            App.finishLogin(`Bem-vindo, ${data.nome}!`);
        } catch (e) { 
            UI.showToast('Erro ao validar login do profissional.', 'error'); 
        }
    },

    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signOut();
        }
        location.reload();
    }
};

const App = {
    user: { loggedIn: false, role: '', name: '' },
    fotoBase64Temp: '',

    init() {
        console.log("HairConcept inicializado com sucesso.");
        this.renderListaProfissionais();
        this.renderProdutos();
        this.renderAgendaGrid();
        this.carregarSelects();
    },

    setPlan(plano) {
        localStorage.setItem('hairconcept_plan', plano);
        
        if (plano === 'mensal') {
            UI.showToast('Redirecionando para o pagamento seguro do Mercado Pago (Plano Mensal)...');
            // Substitua abaixo pelo seu link de Checkout Pro / Pagamento do Mercado Pago
            window.location.href = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=SEU_ID_DE_PREFERENCIA_MENSAL';
        } 
        else if (plano === 'anual') {
            UI.showToast('Redirecionando para o pagamento seguro do Mercado Pago (Plano Anual)...');
            // Substitua abaixo pelo seu link de Checkout Pro / Pagamento do Mercado Pago
            window.location.href = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=SEU_ID_DE_PREFERENCIA_ANUAL';
        } 
        else {
            UI.showToast('Plano Gratuito selecionado com sucesso!');
            UI.switchTab('aba3');
        }
    },

    async finishLogin(msg) {
        if (msg) UI.showToast(msg);
        document.getElementById('aba-login')?.classList.add('hidden');
        document.getElementById('main-header')?.classList.remove('hidden');
        
        const nameDisplay = document.getElementById('user-name-display');
        const roleDisplay = document.getElementById('user-role-display');
        if (nameDisplay) nameDisplay.textContent = this.user.name;
        if (roleDisplay) roleDisplay.textContent = this.user.role.toUpperCase();

        if (this.user.role === 'profissional') {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        }

        if (this.user.role === 'admin') {
            await this.verificarOuCriarEstabelecimento();
        } else {
            UI.switchTab('aba3');
            App.init();
        }
    },

    async verificarOuCriarEstabelecimento() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return;

            const userId = session.user.id;
            const { data: estab, error } = await supabaseClient
                .from('estabelecimentos')
                .select('*')
                .eq('user_id', userId)
                .single();

            const headerSub = document.getElementById('saloon-name-header');

            if (error || !estab) {
                document.getElementById('modal-setup-salao')?.classList.remove('hidden');
            } else {
                localStorage.setItem('hairconcept_estab_id', estab.id);
                if (headerSub) headerSub.textContent = estab.nome_salao;
                UI.switchTab('aba3');
                App.init();
            }
        } catch (e) {
            console.error(e);
            UI.switchTab('aba3');
            App.init();
        }
    },

    async handleSalvarSetupSalao(event) {
        event.preventDefault();
        const nomeSalao = document.getElementById('setup-nome-salao').value;
        const telefone = document.getElementById('setup-telefone-salao').value;

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return;

            const userId = session.user.id;
            const { data, error } = await supabaseClient.from('estabelecimentos').insert([{
                user_id: userId,
                nome_salao: nomeSalao,
                telefone: telefone
            }]).select().single();

            if (error) throw error;

            localStorage.setItem('hairconcept_estab_id', data.id);
            UI.showToast('Salão configurado com sucesso!');
            document.getElementById('modal-setup-salao')?.classList.add('hidden');

            const headerSub = document.getElementById('saloon-name-header');
            if (headerSub) headerSub.textContent = nomeSalao;

            UI.switchTab('aba3');
            App.init();
        } catch (e) {
            UI.showToast('Erro ao salvar estabelecimento: ' + e.message, 'error');
        }
    },

    handleFotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            this.fotoBase64Temp = uploadEvent.target.result;
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
        const estabelecimentoId = localStorage.getItem('hairconcept_estab_id');
        const nomeEstabelecimentoHeader = document.getElementById('saloon-name-header')?.textContent || 'Salão';

        try {
            const { count, error: countError } = await supabaseClient
                .from('profissionais')
                .select('*', { count: 'exact', head: true })
                .eq('estabelecimento_id', estabelecimentoId);

            if (countError) throw countError;

            if (planoAtual === 'gratis' && count >= 2) {
                UI.showToast('Limite atingido! O Plano Gratuito permite apenas 2 profissionais.', 'error');
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

            const { error } = await supabaseClient.from('profissionais').insert([{ 
                estabelecimento_id: estabelecimentoId,
                estabelecimento: nomeEstabelecimentoHeader,
                nome, 
                cargo, 
                cpf, 
                rg, 
                certificado, 
                senha, 
                foto_url 
            }]);

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

    async handleCreateProduto(event) {
        event.preventDefault();
        const estabelecimentoId = localStorage.getItem('hairconcept_estab_id');
        const nome = document.getElementById('prod-nome').value;
        const tipo = document.getElementById('prod-tipo').value;
        const preco_venda = parseFloat(document.getElementById('prod-preco').value) || 0;
        const stock = parseInt(document.getElementById('prod-stock').value) || 0;
        const data_validade = document.getElementById('prod-validade').value;

        try {
            const { error } = await supabaseClient.from('produtos').insert([{
                estabelecimento_id: estabelecimentoId,
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

    async renderListaProfissionais() {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const lista = document.getElementById('lista-profissionais');
        if (!lista) return;
        
        try {
            const { data, error } = await supabaseClient
                .from('profissionais')
                .select('*')
                .eq('estabelecimento_id', estabId);

            if (error) throw error;

            lista.innerHTML = data.map(p => `
                <div class="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img src="${p.foto_url || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-xl object-cover">
                        <div>
                            <h4 class="text-xs font-bold text-white">${p.nome}</h4>
                            <p class="text-[10px] text-brand-500">${p.cargo}</p>
                            <p class="text-[9px] text-zinc-500">CPF: ${p.cpf}</p>
                        </div>
                    </div>
                </div>
            `).join('') || '<p class="text-xs text-zinc-500 col-span-2">Nenhum profissional cadastrado.</p>';
        } catch (e) { console.error(e); }
    },

    async renderProdutos() {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const lista = document.getElementById('lista-produtos');
        if (!lista) return;

        try {
            const { data, error } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('estabelecimento_id', estabId);

            if (error) throw error;

            lista.innerHTML = data.map(prod => `
                <div class="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex justify-between items-center">
                    <div>
                        <h4 class="text-xs font-bold text-white">${prod.nome}</h4>
                        <p class="text-[10px] text-zinc-400">Tipo: ${prod.tipo} | Stock: ${prod.stock} | Validade: ${prod.data_validade}</p>
                    </div>
                    <span class="text-xs font-bold text-brand-500">R$ ${prod.preco_venda}</span>
                </div>
            `).join('') || '<p class="text-xs text-zinc-500">Nenhum produto cadastrado.</p>';
        } catch (e) { console.error(e); }
    },

    async renderAgendaGrid() {
        const body = document.getElementById('grid-horarios-body');
        if (!body) return;
        body.innerHTML = `<tr><td colspan="2" class="py-4 text-center text-zinc-500">Agenda sincronizada.</td></tr>`;
    },

    async carregarSelects() {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const select = document.getElementById('agendamento-profissional');
        if (!select) return;

        try {
            const { data } = await supabaseClient.from('profissionais').select('*').eq('estabelecimento_id', estabId);
            select.innerHTML = (data || []).map(p => `<option value="${p.id}">${p.nome} (${p.cargo})</option>`).join('');
        } catch (e) { console.error(e); }
    },

    async handleCreateAgendamento(e) {
        e.preventDefault();
        UI.showToast('Agendamento simulado com sucesso!');
        e.target.reset();
    }
};

const UI = {
    showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) { alert(msg); return; }
        const toast = document.createElement('div');
        toast.className = `p-4 rounded-2xl bg-zinc-900 border border-white/10 text-xs font-bold text-white shadow-2xl pointer-events-auto transition duration-300 ${type === 'error' ? 'border-red-500/50 text-red-400' : 'border-brand-500/50 text-brand-500'}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3500);
    },
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');
    }
};

window.addEventListener('DOMContentLoaded', () => {
    const hoje = document.getElementById('agendamento-data');
    if (hoje) hoje.valueAsDate = new Date();
    const dataAgenda = document.getElementById('filtro-data-agenda');
    if (dataAgenda) dataAgenda.valueAsDate = new Date();

    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                App.user = { loggedIn: true, role: 'admin', name: name };
                App.finishLogin(`Bem-vindo, ${name}!`);
            }
        });
    }
});
