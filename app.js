const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g2JwYeFICTnivZWJZTzWmg_XzHAUm3Z';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        localStorage.removeItem('hairconcept_prof_id');
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
    user: { loggedIn: false, role: '', name: '', id: null },
    fotoBase64Temp: '',
    init() {
        console.log("HairConcept inicializado.");
        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput && !dataInput.value) {
            dataInput.value = new Date().toISOString().split('T')[0];
        }
        this.renderListaProfissionais();
        this.renderProdutos();
        this.renderAgendaGrid();
        this.carregarPostIts();
        this.popularSelectProfissionais();
        
        if (this.user.role === 'profissional') {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        } else {
            document.getElementById('painel-profissional-extra')?.classList.add('hidden');
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        }
    },
    async finishLogin(msg) {
        if (msg) UI.showToast(msg);
        document.getElementById('aba-login')?.classList.add('hidden');
        document.getElementById('main-header')?.classList.remove('hidden');
        UI.switchTab('aba-agenda');
        
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
                // Caso não tenha estabelecimento cadastrado, pode abrir modal ou criar automático
                this.init();
            } else {
                localStorage.setItem('hairconcept_estab_id', estab.id);
                if (headerSub) headerSub.textContent = estab.nome_salao;
                this.init();
            }
        } catch (e) {
            this.init();
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
                localStorage.setItem('hairconcept_prof_id', data.id);
            }
            this.user = { loggedIn: true, role: 'profissional', name: data.nome, id: data.id };
            const headerSub = document.getElementById('saloon-name-header');
            if (headerSub) headerSub.textContent = data.estabelecimento || nomeEstabelecimento;
            document.getElementById('prof-header-nome').textContent = data.nome;
            document.getElementById('prof-header-cargo').textContent = data.cargo;
            if (data.foto_url) {
                document.getElementById('prof-header-foto').src = data.foto_url;
            }
            this.finishLogin(`Bem-vindo, ${data.nome}!`);
        } catch (e) {
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
            
            const limiteMaximo = planoAtual === 'gratis' ? 2 : 10;
            if (count >= limiteMaximo) {
                UI.showToast(`Limite atingido! O plano ${planoAtual.toUpperCase()} permite apenas ${limiteMaximo} profissionais.`, 'error');
                return;
            }
            
            const nome = document.getElementById('prof-nome').value;
            const cargo = document.getElementById('prof-cargo').value;
            const cpf = document.getElementById('prof-cpf').value;
            const senha = document.getElementById('prof-senha').value;
            const foto_url = this.fotoBase64Temp;
            const { error } = await supabaseClient.from('profissionais').insert([{
                estabelecimento_id: estabelecimentoId,
                estabelecimento: nomeEstabelecimentoHeader,
                nome,
                cargo,
                cpf,
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
            this.popularSelectProfissionais();
        } catch (err) {
            UI.showToast('Erro ao cadastrar profissional: ' + err.message, 'error');
        }
    },
    async handleAtualizarMinhaFoto(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            const profId = localStorage.getItem('hairconcept_prof_id');
            if (!profId) return;
            try {
                const { error } = await supabaseClient
                    .from('profissionais')
                    .update({ foto_url: base64 })
                    .eq('id', profId);
                if (error) throw error;
                document.getElementById('prof-header-foto').src = base64;
                UI.showToast('Foto de perfil atualizada com sucesso!');
                this.renderListaProfissionais();
            } catch (err) {
                UI.showToast('Erro ao atualizar foto: ' + err.message, 'error');
            }
        };
        reader.readAsDataURL(file);
    },
    async popularSelectProfissionais() {
        const select = document.getElementById('agendamento-profissional');
        if (!select) return;
        const estabId = localStorage.getItem('hairconcept_estab_id');
        try {
            const { data } = await supabaseClient.from('profissionais').select('id, nome').eq('estabelecimento_id', estabId);
            if (data) {
                select.innerHTML = data.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
            }
        } catch (e) {
            console.error(e);
        }
    },
    async handleCreateAgendamento(event) {
        event.preventDefault();
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const data = document.getElementById('agendamento-data').value;
        const profissional_id = document.getElementById('agendamento-profissional').value;
        const horario = document.getElementById('agendamento-horario').value;
        const cliente = document.getElementById('cliente-nome').value;
        const servico = "Serviço Padrão";
        const valor = parseFloat(document.getElementById('cliente-valor').value) || 0;
        try {
            const { error } = await supabaseClient.from('agendamentos').insert([{
                estabelecimento_id: estabId,
                data,
                profissional_id,
                horario,
                cliente,
                servico,
                valor
            }]);
            if (error) throw error;
            UI.showToast('Agendamento efetuado com sucesso!');
            event.target.reset();
            UI.switchTab('aba-agenda');
            this.renderAgendaGrid();
        } catch (e) {
            UI.showToast('Erro ao agendar: ' + e.message, 'error');
        }
    },
    async renderAgendaGrid() {
        const tbody = document.getElementById('grid-horarios-body');
        const headerRow = document.getElementById('grid-header-row');
        if (!tbody || !headerRow) return;
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const dataFiltro = document.getElementById('filtro-data-agenda').value;
        try {
            const { data: profs } = await supabaseClient.from('profissionais').select('*').eq('estabelecimento_id', estabId);
            const { data: agendamentos } = await supabaseClient.from('agendamentos').select('*').eq('estabelecimento_id', estabId).eq('data', dataFiltro);
            if (!profs || profs.length === 0) {
                headerRow.innerHTML = '<th class="py-3 px-4">Horário</th><th class="py-3 px-4">Sem profissionais cadastrados</th>';
                tbody.innerHTML = '<tr><td colspan="2" class="py-4 px-4 text-center text-zinc-500">Cadastre profissionais na aba Equipe para ver a agenda.</td></tr>';
                return;
            }
            let profsExibicao = profs;
            if (this.user.role === 'profissional') {
                profsExibicao = profs.filter(p => p.id == this.user.id);
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
            `).join('');

            const horarios = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
            let atendimentoCount = 0;
            let totalGanhos = 0;

            tbody.innerHTML = horarios.map(h => {
                return `<tr class="border-b border-white/5">
                    <td class="py-3 px-4 text-brand-500 font-bold">${h}</td>` +
                    profsExibicao.map(p => {
                        const ag = (agendamentos || []).find(a => a.profissional_id == p.id && a.horario === h);
                        if (ag && this.user.role === 'profissional') {
                            atendimentoCount++;
                            totalGanhos += (ag.valor * 0.5);
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
            }).join('');

            if (this.user.role === 'profissional') {
                document.getElementById('prof-stat-atendimentos').textContent = atendimentoCount;
                document.getElementById('prof-stat-comissao').textContent = `R$ ${totalGanhos.toFixed(2)}`;
            }
        } catch (e) {
            console.error(e);
        }
    },
    async handleCreateProduto(event) {
        event.preventDefault();
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const nome = document.getElementById('prod-nome').value;
        const tipo = document.getElementById('prod-tipo').value;
        const preco_venda = parseFloat(document.getElementById('prod-preco').value) || 0;
        const stock = parseInt(document.getElementById('prod-stock').value) || 0;
        const data_validade = document.getElementById('prod-validade').value;
        try {
            const { error } = await supabaseClient.from('produtos').insert([{
                estabelecimento_id: estabId,
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
            const { data, error } = await supabaseClient.from('profissionais').select('*').eq('estabelecimento_id', estabId);
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
        const alertaBadge = document.getElementById('alerta-validade-badge');
        if (!lista) return;
        try {
            const { data, error } = await supabaseClient.from('produtos').select('*').eq('estabelecimento_id', estabId);
            if (error) throw error;
            const hoje = new Date();
            const daqui3Meses = new Date();
            daqui3Meses.setMonth(hoje.getMonth() + 3);
            let alertaCount = 0;
            lista.innerHTML = data.map(prod => {
                const dataVal = new Date(prod.data_validade);
                const pertoVencer = dataVal <= daqui3Meses && dataVal >= hoje;
                if (pertoVencer) alertaCount++;
                return `
                    <div class="p-3.5 rounded-2xl bg-zinc-950 border ${pertoVencer ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10'} flex justify-between items-center">
                        <div>
                            <h4 class="text-xs font-bold text-white">${prod.nome} ${pertoVencer ? '<span class="text-[9px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full ml-2">Validade Próxima (&lt; 3 meses)</span>' : ''}</h4>
                            <p class="text-[10px] text-zinc-400">Stock: ${prod.stock} | Validade: ${prod.data_validade} | Tipo: ${prod.tipo}</p>
                        </div>
                        <span class="text-xs font-bold text-brand-500">R$ ${prod.preco_venda.toFixed(2)}</span>
                    </div>
                `;
            }).join('') || '<p class="text-xs text-zinc-500">Nenhum produto registado.</p>';
            if (alertaBadge) {
                alertaBadge.textContent = alertaCount > 0 ? `${alertaCount} alerta(s) de validade` : 'Stock Regular';
            }
        } catch (e) {
            console.error(e);
        }
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
    carregarPostIts() {
        const container = document.getElementById('lista-postits');
        if (!container) return;
        const postits = JSON.parse(localStorage.getItem('hairconcept_postits') || '["Ligar para fornecedor de tesouras", "Comprar novo secador de cabelo"]');
        container.innerHTML = postits.map((nota, index) => `
            <div class="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs flex justify-between items-center">
                <span>${nota}</span>
                <button onclick="App.removerPostIt(${index})" class="text-zinc-400 hover:text-red-400 text-xs"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('') || '<p class="text-[10px] text-zinc-500">Nenhuma nota colada.</p>';
    },
    adicionarPostIt() {
        const nota = prompt("Digite a sua nova nota ou lembrete:");
        if (!nota || nota.trim() === '') return;
        const postits = JSON.parse(localStorage.getItem('hairconcept_postits') || '[]');
        postits.push(nota);
        localStorage.setItem('hairconcept_postits', JSON.stringify(postits));
        this.carregarPostIts();
    },
    removerPostIt(index) {
        const postits = JSON.parse(localStorage.getItem('hairconcept_postits') || '[]');
        postits.splice(index, 1);
        localStorage.setItem('hairconcept_postits', JSON.stringify(postits));
        this.carregarPostIts();
    },
    calcularGanhosPessoal() {
        const val = parseFloat(document.getElementById('prof-calc-val').value) || 0;
        const porc = parseFloat(document.getElementById('prof-calc-porc').value) || 50;
        const total = (val * porc) / 100;
        document.getElementById('prof-calc-result').textContent = `R$ ${total.toFixed(2)}`;
    },
    proximaFrase() {
        const frases = [
            "O sucesso é a soma de pequenos esforços repetidos.",
            "A beleza está nos detalhes e no carinho com o cliente.",
            "Um dia produtivo começa com um sorriso e foco.",
            "Transforme a sua arte em excelência todos os dias."
        ];
        const aleatoria = frases[Math.floor(Math.random() * frases.length)];
        document.getElementById('frase-motivacional').textContent = `"${aleatoria}"`;
    },
    setPlan(plano) {
        localStorage.setItem('hairconcept_plan', plano);
        UI.showToast(`Plano ${plano.toUpperCase()} ativado com sucesso!`);
        UI.switchTab('aba-agenda');
    },
    mudarDia(dias) {
        const dataInput = document.getElementById('filtro-data-agenda');
        if (!dataInput.value) return;
        const atual = new Date(dataInput.value + 'T00:00:00');
        atual.setDate(atual.getDate() + dias);
        dataInput.value = atual.toISOString().split('T')[0];
        this.renderAgendaGrid();
    },
    irParaHoje() {
        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput) {
            dataInput.value = new Date().toISOString().split('T')[0];
            this.renderAgendaGrid();
        }
    },
    saltarParaMes(mesIndex) {
        const ano = 2026;
        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput) {
            const mesStr = String(parseInt(mesIndex) + 1).padStart(2, '0');
            dataInput.value = `${ano}-${mesStr}-01`;
            this.renderAgendaGrid();
        }
    }
};

const UI = {
    showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `p-3 rounded-2xl glass-water border ${type === 'error' ? 'border-rose-500/50 text-rose-300' : 'border-emerald-500/50 text-emerald-300'} text-xs font-bold uppercase shadow-xl transition-all transform translate-y-2 opacity-0`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');
    }
};

window.addEventListener('DOMContentLoaded', () => {
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
