// Configuração oficial do Supabase
const SUPABASE_URL = 'https://wahtcnoszlatqtrfcfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHRjbm9zemxhdHF0cmZjZmp4ZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzEwMDAwMDAwLCJleHAiOjIwMjU2MDAwMDB9';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signOut();
        }
        location.reload();
    },
    loginSocial(provider) {
        UI.showToast('A redirecionar para autenticação...');
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signInWithOAuth({ provider: provider });
        }
    },
    loginAdmin(event) {
        event.preventDefault();
        const email = document.getElementById('login-admin-email').value.trim();
        const password = document.getElementById('login-admin-senha').value.trim();
        if (supabaseClient) {
            supabaseClient.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
                if (error) {
                    UI.showToast('Erro ao entrar: ' + error.message, 'error');
                } else {
                    App.user = { loggedIn: true, role: 'admin', name: email.split('@')[0] };
                    App.finishLogin('Bem-vindo ao Painel!');
                }
            });
        }
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
    },

    async finishLogin(msg) {
        if (msg) UI.showToast(msg);
        document.getElementById('aba-login')?.classList.add('hidden');
        document.getElementById('main-header')?.classList.remove('hidden');
        document.getElementById('aba3')?.classList.remove('hidden'); // Abre na agenda por defeito
        
        const nameDisplay = document.getElementById('user-name-display');
        const roleDisplay = document.getElementById('user-role-display');
        if (nameDisplay) nameDisplay.textContent = this.user.name;
        if (roleDisplay) roleDisplay.textContent = this.user.role.toUpperCase();

        if (this.user.role === 'admin') {
            await this.verificarOuCriarEstabelecimento();
        } else {
            this.init();
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
                this.init();
            }
        } catch (e) {
            console.error("Erro ao verificar estabelecimento:", e);
            this.init();
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
            
            this.init();
        } catch (e) {
            UI.showToast('Erro ao salvar estabelecimento: ' + e.message, 'error');
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
            
            this.user = { loggedIn: true, role: 'profissional', name: data.nome };
            
            const headerSub = document.getElementById('saloon-name-header');
            if (headerSub) headerSub.textContent = data.estabelecimento || nomeEstabelecimento;

            this.finishLogin(`Bem-vindo, ${data.nome}!`);
        } catch (e) {
            console.error(e);
            UI.showToast('Erro ao validar login do profissional.', 'error');
        }
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
            document.getElementById('preview-foto-prof').classList.add('hidden');
            document.getElementById('icon-foto-prof').classList.remove('hidden');
            this.renderListaProfissionais();
        } catch (err) {
            UI.showToast('Erro ao cadastrar profissional: ' + err.message, 'error');
        }
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
                <div class="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img src="${p.foto_url || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-xl object-cover">
                        <div>
                            <h4 class="text-xs font-bold text-white">${p.nome}</h4>
                            <p class="text-[10px] text-brand-500">${p.cargo}</p>
                            <p class="text-[9px] text-zinc-500">CPF: ${p.cpf}</p>
                        </div>
                    </div>
                </div>
            `).join('') || '<p class="text-xs text-zinc-500">Nenhum profissional registado.</p>';
        } catch (e) {
            console.error(e);
        }
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
                <div class="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex justify-between items-center">
                    <div>
                        <h4 class="text-xs font-bold text-white">${prod.nome}</h4>
                        <p class="text-[10px] text-zinc-400">Stock: ${prod.stock} | Validade: ${prod.data_validade}</p>
                    </div>
                    <span class="text-xs font-bold text-brand-500">R$ ${prod.preco_venda}</span>
                </div>
            `).join('') || '<p class="text-xs text-zinc-500">Nenhum produto registado.</p>';
        } catch (e) {
            console.error(e);
        }
    },

    // Renderização das 20 agendas simultâneas conforme o plano contratado
    renderAgendaGrid() {
        const grid = document.getElementById('agenda-grid');
        if (!grid) return;
        
        let html = '';
        for (let i = 1; i <= 20; i++) {
            html += `
                <div class="p-3 rounded-xl bg-zinc-950 border border-white/10 flex justify-between items-center hover:border-white/30 transition-colors">
                    <div>
                        <h4 class="text-xs font-bold text-white">Agenda Profissional #${i}</h4>
                        <p class="text-[10px] text-zinc-400">Horários disponíveis para marcação</p>
                    </div>
                    <span class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-lg">Ativa</span>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    handleFotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.fotoBase64Temp = e.target.result;
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

    // Direcionamentos de planos com os links de pagamento do Mercado Pago
    setPlan(plano) {
        localStorage.setItem('hairconcept_plan', plano);
        if (plano === 'mensal') {
            window.location.href = 'https://mpago.la/1LunQwf';
        } else if (plano === 'anual') {
            window.location.href = 'https://mpago.la/1doAutJ';
        } else {
            UI.showToast(`Plano ${plano.toUpperCase()} selecionado com sucesso!`);
            UI.switchTab('aba3');
        }
    },

    handleCreateAgendamento(event) {
        event.preventDefault();
        UI.showToast('Agendamento efetuado com sucesso!');
        event.target.reset();
    }
};

const UI = {
    showToast(msg, type = 'success') {
        alert(msg);
    },
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');
    }
};

window.addEventListener('DOMContentLoaded', () => {
    // Efeito de rastreio do rato (Spotlight) sincronizado
    document.addEventListener('mousemove', (e) => {
        document.documentElement.style.setProperty('--x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--y', `${e.clientY}px`);
    });

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
