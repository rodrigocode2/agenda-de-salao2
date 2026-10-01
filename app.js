// Configuração oficial do Supabase
const SUPABASE_URL = 'https://wahtcnoszlatqtrfcfjxe.supabase.co';[cite: 247]
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHRjbm9zemxhdHF0cmZjZmp4ZSIsInJvbGUiOiJhbm9uIiwi';[cite: 247]

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;[cite: 247]

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');[cite: 247]
        localStorage.removeItem('hairconcept_prof_id');[cite: 247]
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signOut();[cite: 247]
        }
        location.reload();[cite: 247]
    },
    loginSocial(provider) {
        UI.showToast('A redirecionar para autenticação...');[cite: 247]
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signInWithOAuth({ provider: provider });[cite: 247]
        }
    },
    loginAdmin(event) {
        event.preventDefault();[cite: 247]
        const email = document.getElementById('login-admin-email').value.trim();[cite: 247]
        const password = document.getElementById('login-admin-senha').value.trim();[cite: 247]
        if (supabaseClient) {
            supabaseClient.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
                if (error) {
                    UI.showToast('Erro ao entrar: ' + error.message, 'error');[cite: 247]
                } else {
                    App.user = { loggedIn: true, role: 'admin', name: email.split('@')[0] };[cite: 247]
                    App.finishLogin('Bem-vindo ao Painel!');[cite: 247]
                }
            });
        }
    }
};

const App = {
    user: { loggedIn: false, role: '', name: '', id: null },[cite: 255]
    fotoBase64Temp: '',[cite: 255]
    init() {
        console.log("HairConcept inicializado.");[cite: 255]
        const dataInput = document.getElementById('filtro-data-agenda');[cite: 255]
        if (dataInput && !dataInput.value) {
            dataInput.value = new Date().toISOString().split('T')[0];[cite: 255]
        }
        this.renderListaProfissionais();[cite: 255]
        this.renderProdutos();[cite: 255]
        this.renderAgendaGrid();[cite: 255]
        this.carregarPostIts();[cite: 255]
        this.popularSelectProfissionais();[cite: 255]
        
        if (this.user.role === 'profissional') {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');[cite: 255]
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));[cite: 255]
        } else {
            document.getElementById('painel-profissional-extra')?.classList.add('hidden');[cite: 255]
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));[cite: 255]
        }
    },
    async finishLogin(msg) {
        if (msg) UI.showToast(msg);[cite: 255]
        document.getElementById('aba-login')?.classList.add('hidden');[cite: 255]
        document.getElementById('main-header')?.classList.remove('hidden');[cite: 255]
        UI.switchTab('aba-agenda');[cite: 255]
        
        const nameDisplay = document.getElementById('user-name-display');[cite: 255]
        const roleDisplay = document.getElementById('user-role-display');[cite: 255]
        if (nameDisplay) nameDisplay.textContent = this.user.name;[cite: 255]
        if (roleDisplay) roleDisplay.textContent = this.user.role.toUpperCase();[cite: 255]
        
        if (this.user.role === 'admin') {
            await this.verificarOuCriarEstabelecimento();[cite: 255]
        } else {
            this.init();[cite: 255]
        }
    },
    async verificarOuCriarEstabelecimento() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();[cite: 255]
            if (!session || !session.user) return;[cite: 255]
            const userId = session.user.id;[cite: 255]
            const { data: estab, error } = await supabaseClient
                .from('estabelecimentos')
                .select('*')
                .eq('user_id', userId)
                .single();[cite: 255]
            const headerSub = document.getElementById('saloon-name-header');[cite: 255]
            if (error || !estab) {
                document.getElementById('modal-setup-salao')?.classList.remove('hidden');[cite: 255]
            } else {
                localStorage.setItem('hairconcept_estab_id', estab.id);[cite: 255]
                if (headerSub) headerSub.textContent = estab.nome_salao;[cite: 255]
                this.init();[cite: 255]
            }
        } catch (e) {
            this.init();[cite: 255]
        }
    },
    async handleSalvarSetupSalao(event) {
        event.preventDefault();[cite: 256]
        const nomeSalao = document.getElementById('setup-nome-salao').value;[cite: 256]
        const telefone = document.getElementById('setup-telefone-salao').value;[cite: 256]
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();[cite: 256]
            if (!session || !session.user) return;[cite: 256]
            const userId = session.user.id;[cite: 256]
            const { data, error } = await supabaseClient.from('estabelecimentos').insert([{
                user_id: userId,
                nome_salao: nomeSalao,
                telefone: telefone
            }]).select().single();[cite: 256]
            if (error) throw error;[cite: 256]
            localStorage.setItem('hairconcept_estab_id', data.id);[cite: 256]
            UI.showToast('Salão configurado com sucesso!');[cite: 256]
            document.getElementById('modal-setup-salao')?.classList.add('hidden');[cite: 256]
            const headerSub = document.getElementById('saloon-name-header');[cite: 256]
            if (headerSub) headerSub.textContent = nomeSalao;[cite: 256]
            this.init();[cite: 256]
        } catch (e) {
            UI.showToast('Erro ao salvar estabelecimento: ' + e.message, 'error');[cite: 256]
        }
    },
    async loginProfissional(event) {
        event.preventDefault();[cite: 256]
        const nomeEstabelecimento = document.getElementById('login-prof-estabelecimento').value.trim();[cite: 256]
        const cpf = document.getElementById('login-prof-id').value.trim();[cite: 256]
        const senha = document.getElementById('login-prof-senha').value.trim();[cite: 256]
        try {
            const { data, error } = await supabaseClient
                .from('profissionais')
                .select('*')
                .ilike('estabelecimento', nomeEstabelecimento)
                .eq('cpf', cpf)
                .eq('senha', senha)
                .single();[cite: 256]
            if (error || !data) {
                UI.showToast('Estabelecimento, CPF ou senha incorretos.', 'error');[cite: 256]
                return;
            }
            if (data.estabelecimento_id) {
                localStorage.setItem('hairconcept_estab_id', data.estabelecimento_id);[cite: 256]
                localStorage.setItem('hairconcept_prof_id', data.id);[cite: 256]
            }
            this.user = { loggedIn: true, role: 'profissional', name: data.nome, id: data.id };[cite: 256]
            const headerSub = document.getElementById('saloon-name-header');[cite: 256]
            if (headerSub) headerSub.textContent = data.estabelecimento || nomeEstabelecimento;[cite: 256]
            document.getElementById('prof-header-nome').textContent = data.nome;[cite: 256]
            document.getElementById('prof-header-cargo').textContent = data.cargo;[cite: 256]
            if (data.foto_url) {
                document.getElementById('prof-header-foto').src = data.foto_url;[cite: 256]
            }
            this.finishLogin(`Bem-vindo, ${data.nome}!`);[cite: 256]
        } catch (e) {
            UI.showToast('Erro ao validar login do profissional.', 'error');[cite: 256]
        }
    },
    async handleCreateProfissional(e) {
        e.preventDefault();[cite: 257]
        const planoAtual = localStorage.getItem('hairconcept_plan') || 'gratis';[cite: 257]
        const estabelecimentoId = localStorage.getItem('hairconcept_estab_id');[cite: 257]
        const nomeEstabelecimentoHeader = document.getElementById('saloon-name-header')?.textContent || 'Salão';[cite: 257]
        try {
            const { count, error: countError } = await supabaseClient
                .from('profissionais')
                .select('*', { count: 'exact', head: true })
                .eq('estabelecimento_id', estabelecimentoId);[cite: 257]
            if (countError) throw countError;[cite: 257]
            if (planoAtual === 'gratis' && count >= 2) {
                UI.showToast('Limite atingido! O Plano Gratuito permite apenas 2 profissionais.', 'error');[cite: 257]
                return;
            }
            const nome = document.getElementById('prof-nome').value;[cite: 257]
            const cargo = document.getElementById('prof-cargo').value;[cite: 257]
            const cpf = document.getElementById('prof-cpf').value;[cite: 257]
            const senha = document.getElementById('prof-senha').value;[cite: 257]
            const foto_url = this.fotoBase64Temp;[cite: 257]
            const { error } = await supabaseClient.from('profissionais').insert([{
                estabelecimento_id: estabelecimentoId,
                estabelecimento: nomeEstabelecimentoHeader,
                nome,
                cargo,
                cpf,
                senha,
                foto_url
            }]);[cite: 257]
            if (error) throw error;[cite: 257]
            UI.showToast('Profissional cadastrado com sucesso!');[cite: 257]
            e.target.reset();[cite: 257]
            this.fotoBase64Temp = '';[cite: 257]
            document.getElementById('preview-foto-prof').classList.add('hidden');[cite: 257]
            document.getElementById('icon-foto-prof').classList.remove('hidden');[cite: 257]
            this.renderListaProfissionais();[cite: 257]
            this.popularSelectProfissionais();[cite: 257]
        } catch (err) {
            UI.showToast('Erro ao cadastrar profissional: ' + err.message, 'error');[cite: 257]
        }
    },
    async handleAtualizarMinhaFoto(event) {
        const file = event.target.files[0];[cite: 258]
        if (!file) return;[cite: 258]
        const reader = new FileReader();[cite: 258]
        reader.onload = async (e) => {
            const base64 = e.target.result;[cite: 258]
            const profId = localStorage.getItem('hairconcept_prof_id');[cite: 258]
            if (!profId) return;[cite: 258]
            try {
                const { error } = await supabaseClient
                    .from('profissionais')
                    .update({ foto_url: base64 })
                    .eq('id', profId);[cite: 258]
                if (error) throw error;[cite: 258]
                document.getElementById('prof-header-foto').src = base64;[cite: 258]
                UI.showToast('Foto de perfil atualizada com sucesso!');[cite: 258]
                this.renderListaProfissionais();[cite: 258]
            } catch (err) {
                UI.showToast('Erro ao atualizar foto: ' + err.message, 'error');[cite: 258]
            }
        };
        reader.readAsDataURL(file);[cite: 258]
    },
    async popularSelectProfissionais() {
        const select = document.getElementById('agendamento-profissional');[cite: 258]
        if (!select) return;[cite: 258]
        const estabId = localStorage.getItem('hairconcept_estab_id');[cite: 258]
        try {
            const { data } = await supabaseClient.from('profissionais').select('id, nome').eq('estabelecimento_id', estabId);[cite: 258]
            if (data) {
                select.innerHTML = data.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');[cite: 258]
            }
        } catch (e) {
            console.error(e);[cite: 258]
        }
    },
    async handleCreateAgendamento(event) {
        event.preventDefault();[cite: 259]
        const estabId = localStorage.getItem('hairconcept_estab_id');[cite: 259]
        const data = document.getElementById('agendamento-data').value;[cite: 259]
        const profissional_id = document.getElementById('agendamento-profissional').value;[cite: 259]
        const horario = document.getElementById('agendamento-horario').value;[cite: 259]
        const cliente = document.getElementById('cliente-nome').value;[cite: 259]
        const servico = document.getElementById('cliente-servico').value;[cite: 259]
        const valor = parseFloat(document.getElementById('cliente-valor').value) || 0;[cite: 259]
        try {
            const { error } = await supabaseClient.from('agendamentos').insert([{
                estabelecimento_id: estabId,
                data,
                profissional_id,
                horario,
                cliente,
                servico,
                valor
            }]);[cite: 259]
            if (error) throw error;[cite: 259]
            UI.showToast('Agendamento efetuado com sucesso!');[cite: 259]
            event.target.reset();[cite: 259]
            UI.switchTab('aba-agenda');[cite: 259]
            this.renderAgendaGrid();[cite: 259]
        } catch (e) {
            UI.showToast('Erro ao agendar: ' + e.message, 'error');[cite: 259]
        }
    },
    async renderAgendaGrid() {
        const tbody = document.getElementById('grid-horarios-body');[cite: 259]
        const headerRow = document.getElementById('grid-header-row');[cite: 259]
        if (!tbody || !headerRow) return;[cite: 259]
        const estabId = localStorage.getItem('hairconcept_estab_id');[cite: 259]
        const dataFiltro = document.getElementById('filtro-data-agenda').value;[cite: 259]
        try {
            const { data: profs } = await supabaseClient.from('profissionais').select('*').eq('estabelecimento_id', estabId);[cite: 259]
            const { data: agendamentos } = await supabaseClient.from('agendamentos').select('*').eq('estabelecimento_id', estabId).eq('data', dataFiltro);[cite: 259]
            if (!profs || profs.length === 0) {
                headerRow.innerHTML = '<th class="py-3 px-4">Horário</th><th class="py-3 px-4">Sem profissionais cadastrados</th>';[cite: 259]
                tbody.innerHTML = '<tr><td colspan="2" class="py-4 px-4 text-center text-zinc-500">Cadastre profissionais na aba Equipa para ver a agenda.</td></tr>';[cite: 259]
                return;
            }
            let profsExibicao = profs;[cite: 259]
            if (this.user.role === 'profissional') {
                profsExibicao = profs.filter(p => p.id == this.user.id);[cite: 259]
            }
            headerRow.innerHTML = '<th class="py-3 px-4 w-24">Horário</th>' + profsExibicao.map(p => `
                <th class="py-3 px-4">
                    <div class="flex items-center gap-2">
                        <img src="${p.foto_url || 'https://via.placeholder.com/150'}" class="w-7 h-7 rounded-lg object-cover">
                        <div>
                            <span class="block text-white font-bold">${p.nome}</span>
                            <span class="text-[9px] text-zinc-400">${p.cargo}</span>
                        </div>
                    </div>
                </th>
            `).join('');[cite: 259]

            const horarios = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];[cite: 259]
            let atendimentoCount = 0;[cite: 259]
            let totalGanhos = 0;[cite: 259]

            tbody.innerHTML = horarios.map(h => {
                return `<tr class="border-b border-white/5">
                    <td class="py-3 px-4 text-brand-500 font-bold">${h}</td>` +
                    profsExibicao.map(p => {
                        const ag = (agendamentos || []).find(a => a.profissional_id == p.id && a.horario === h);
                        if (ag && this.user.role === 'profissional') {
                            atendimentoCount++;[cite: 259]
                            totalGanhos += (ag.valor * 0.5);[cite: 259]
                        }
                        return `<td class="py-3 px-4">
                            ${ag ? `
                                <div class="p-2 rounded-xl bg-brand-500/10 border border-brand-500/30 text-[11px]">
                                    <strong class="text-white block">${ag.cliente}</strong>
                                    <span class="text-zinc-300">${ag.servico}</span>
                                    <span class="text-brand-400 block font-bold mt-0.5">R$ ${ag.valor.toFixed(2)}</span>
                                </div>
                            ` : '<span class="text-zinc-600 text-[11px]">Disponível</span>'}
                        </td>`;
                    }).join('') +
                `</tr>`;
            }).join('');[cite: 259]

            if (this.user.role === 'profissional') {
                document.getElementById('prof-stat-atendimentos').textContent = atendimentoCount;[cite: 259]
                document.getElementById('prof-stat-comissao').textContent = `R$ ${totalGanhos.toFixed(2)}`;[cite: 259]
            }
        } catch (e) {
            console.error(e);[cite: 259]
        }
    },
    async handleCreateProduto(event) {
        event.preventDefault();[cite: 259]
        const estabId = localStorage.getItem('hairconcept_estab_id');[cite: 259]
        const nome = document.getElementById('prod-nome').value;[cite: 259]
        const tipo = document.getElementById('prod-tipo').value;[cite: 259]
        const preco_venda = parseFloat(document.getElementById('prod-preco').value) || 0;[cite: 259]
        const stock = parseInt(document.getElementById('prod-stock').value) || 0;[cite: 259]
        const data_validade = document.getElementById('prod-validade').value;[cite: 259]
        try {
            const { error } = await supabaseClient.from('produtos').insert([{
                estabelecimento_id: estabId,
                nome,
                tipo,
                preco_venda,
                stock,
                data_validade
            }]);[cite: 259]
            if (error) throw error;[cite: 259]
            UI.showToast('Produto cadastrado com sucesso!');[cite: 259]
            event.target.reset();[cite: 259]
            this.renderProdutos();[cite: 259]
        } catch (e) {
            UI.showToast('Erro ao cadastrar produto: ' + e.message, 'error');[cite: 259]
        }
    },
    async renderListaProfissionais() {
        const estabId = localStorage.getItem('hairconcept_estab_id');[cite: 260]
        const lista = document.getElementById('lista-profissionais');[cite: 260]
        const badge = document.getElementById('limite-profissionais-badge');[cite: 260]
        if (!lista) return;[cite: 260]
        try {
            const { data, error } = await supabaseClient.from('profissionais').select('*').eq('estabelecimento_id', estabId);[cite: 260]
            if (error) throw error;[cite: 260]
            if (badge) badge.textContent = `${data.length} Integrantes Ativos`;[cite: 260]
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
            `).join('') || '<p class="text-xs text-zinc-500">Nenhum profissional registado.</p>';[cite: 260]
        } catch (e) {
            console.error(e);[cite: 260]
        }
    },
    async renderProdutos() {
        const estabId = localStorage.getItem('hairconcept_estab_id');[cite: 260]
        const lista = document.getElementById('lista-produtos');[cite: 260]
        const alertaBadge = document.getElementById('alerta-validade-badge');[cite: 260]
        if (!lista) return;[cite: 260]
        try {
            const { data, error } = await supabaseClient.from('produtos').select('*').eq('estabelecimento_id', estabId);[cite: 260]
            if (error) throw error;[cite: 260]
            const hoje = new Date();[cite: 260]
            const daqui3Meses = new Date();[cite: 260]
            daqui3Meses.setMonth(hoje.getMonth() + 3);[cite: 260]
            let alertaCount = 0;[cite: 260]
            lista.innerHTML = data.map(prod => {
                const dataVal = new Date(prod.data_validade);[cite: 260]
                const pertoVencer = dataVal <= daqui3Meses && dataVal >= hoje;[cite: 260]
                if (pertoVencer) alertaCount++;[cite: 260]
                return `
                    <div class="p-3.5 rounded-2xl bg-zinc-950 border ${pertoVencer ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10'} flex justify-between items-center">
                        <div>
                            <h4 class="text-xs font-bold text-white">${prod.nome} ${pertoVencer ? '<span class="text-[9px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full ml-2">Validade Próxima (&lt; 3 meses)</span>' : ''}</h4>
                            <p class="text-[10px] text-zinc-400">Stock: ${prod.stock} | Validade: ${prod.data_validade} | Tipo: ${prod.tipo}</p>
                        </div>
                        <span class="text-xs font-bold text-brand-500">R$ ${prod.preco_venda.toFixed(2)}</span>
                    </div>
                `;
            }).join('') || '<p class="text-xs text-zinc-500">Nenhum produto registado.</p>';[cite: 260]
            if (alertaBadge) {
                alertaBadge.textContent = alertaCount > 0 ? `${alertaCount} alerta(s) de validade` : 'Stock Regular';[cite: 260]
            }
        } catch (e) {
            console.error(e);[cite: 260]
        }
    },
    handleFotoUpload(event) {
        const file = event.target.files[0];[cite: 260]
        if (!file) return;[cite: 260]
        const reader = new FileReader();[cite: 260]
        reader.onload = (e) => {
            this.fotoBase64Temp = e.target.result;[cite: 260]
            const preview = document.getElementById('preview-foto-prof');[cite: 260]
            const icon = document.getElementById('icon-foto-prof');[cite: 260]
            if (preview) {
                preview.src = this.fotoBase64Temp;[cite: 260]
                preview.classList.remove('hidden');[cite: 260]
            }
            if (icon) icon.classList.add('hidden');[cite: 260]
        };
        reader.readAsDataURL(file);[cite: 260]
    },
    carregarPostIts() {
        const container = document.getElementById('lista-postits');[cite: 260]
        if (!container) return;[cite: 260]
        const postits = JSON.parse(localStorage.getItem('hairconcept_postits') || '["Ligar para fornecedor de tesouras", "Comprar novo secador de cabelo"]');[cite: 260]
        container.innerHTML = postits.map((nota, index) => `
            <div class="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs flex justify-between items-center">
                <span>${nota}</span>
                <button onclick="App.removerPostIt(${index})" class="text-zinc-400 hover:text-red-400 text-xs"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('') || '<p class="text-[10px] text-zinc-500">Nenhuma nota colada.</p>';[cite: 261]
    },
    adicionarPostIt() {
        const nota = prompt("Digite a sua nova nota ou lembrete:");[cite: 261]
        if (!nota || nota.trim() === '') return;[cite: 261]
        const postits = JSON.parse(localStorage.getItem('hairconcept_postits') || '[]');[cite: 261]
        postits.push(nota);[cite: 261]
        localStorage.setItem('hairconcept_postits', JSON.stringify(postits));[cite: 261]
        this.carregarPostIts();[cite: 261]
    },
    removerPostIt(index) {
        const postits = JSON.parse(localStorage.getItem('hairconcept_postits') || '[]');[cite: 261]
        postits.splice(index, 1);[cite: 261]
        localStorage.setItem('hairconcept_postits', JSON.stringify(postits));[cite: 261]
        this.carregarPostIts();[cite: 261]
    },
    calcularGanhosPessoal() {
        const val = parseFloat(document.getElementById('prof-calc-val').value) || 0;[cite: 261]
        const porc = parseFloat(document.getElementById('prof-calc-porc').value) || 50;[cite: 261]
        const total = (val * porc) / 100;[cite: 261]
        document.getElementById('prof-calc-result').textContent = `R$ ${total.toFixed(2)}`;[cite: 261]
    },
    proximaFrase() {
        const frases = [
            "O sucesso é a soma de pequenos esforços repetidos.",
            "A beleza está nos detalhes e no carinho com o cliente.",
            "Um dia produtivo começa com um sorriso e foco.",
            "Transforme a sua arte em excelência todos os dias."
        ];[cite: 261]
        const aleatoria = frases[Math.floor(Math.random() * frases.length)];[cite: 261]
        document.getElementById('frase-motivacional').textContent = `"${aleatoria}"`;[cite: 261]
    },
    setPlan(plano) {
        localStorage.setItem('hairconcept_plan', plano);[cite: 261]
        UI.showToast(`Plano ${plano.toUpperCase()} selecionado com sucesso!`);[cite: 261]
        UI.switchTab('aba-agenda');[cite: 261]
    }
};

const UI = {
    showToast(msg, type = 'success') {
        alert(msg);[cite: 261]
    },
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));[cite: 261]
        document.getElementById(tabId)?.classList.remove('hidden');[cite: 261]
    }
};

window.addEventListener('DOMContentLoaded', () => {
    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];[cite: 261]
                App.user = { loggedIn: true, role: 'admin', name: name };[cite: 261]
                App.finishLogin(`Bem-vindo, ${name}!`);[cite: 261]
            }
        });
    }
});
