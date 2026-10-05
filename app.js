const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g2JwYeFICTnivZWJZTzWmg_XzHAUm3Z';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Foto padrão (o site via.placeholder.com saiu do ar)
const FOTO_PADRAO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='150' height='150' fill='%2327272a'/%3E%3Ccircle cx='75' cy='58' r='26' fill='%2352525b'/%3E%3Crect x='32' y='96' width='86' height='40' rx='20' fill='%2352525b'/%3E%3C/svg%3E";

// Traduz erro tecnico para portugues claro. O erro original fica no Console.
function mensagemAmigavel(err) {
    const bruto = String((err && err.message) ? err.message : err || '');
    const codigo = String((err && err.code) ? err.code : '');
    const txt = (bruto + ' ' + codigo).toLowerCase();
    console.warn('Erro tecnico:', bruto, codigo);
    if (txt.indexOf('rate limit') >= 0) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    if (codigo === '23505' || txt.indexOf('duplicate key') >= 0) return 'Este registro ja existe. Confira os dados e tente de novo.';
    if (codigo === '23503' || txt.indexOf('foreign key') >= 0) return 'Este item tem historico ligado a ele e nao pode ser apagado.';
    if (txt.indexOf('row-level security') >= 0) return 'Voce nao tem permissao para esta acao. Saia e entre de novo.';
    if (txt.indexOf('jwt') >= 0 || txt.indexOf('session') >= 0) return 'Sua sessao expirou. Saia e entre de novo.';
    if (txt.indexOf('failed to fetch') >= 0 || txt.indexOf('network') >= 0) return 'Sem conexao com o servidor. Confira a internet e tente de novo.';
    if (txt.indexOf('invalid login') >= 0 || txt.indexOf('credentials') >= 0) return 'E-mail ou senha incorretos.';
    if (txt.indexOf('user already registered') >= 0) return 'Este e-mail ja tem uma conta. Use Esqueci minha senha.';
    return 'Nao consegui concluir agora. Tente de novo em instantes.';
}

// Data local no formato AAAA-MM-DD (toISOString usa UTC e adianta o dia à noite)
function dataLocalISO(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
}

function parseValor(valorStr) {
    if (!valorStr) return 0;
    let limpo = String(valorStr).trim();
    if (limpo.includes('.') && limpo.includes(',')) {
        limpo = limpo.replace(/\./g, '').replace(',', '.');
    } else if (limpo.includes(',')) {
        limpo = limpo.replace(',', '.');
    }
    return parseFloat(limpo) || 0;
}

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        localStorage.removeItem('hairconcept_prof_id');
        localStorage.removeItem('hairconcept_plan');
        localStorage.removeItem('hairconcept_prof_dados');
        localStorage.removeItem('hairconcept_plan_pendente');
        // Não apaga hairconcept_boasvindas_* : é para nunca mais aparecer
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signOut();
        }
        location.reload();
    },
    loginSocial(provider) {
        UI.showToast('Redirecionando para autenticação...');
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signInWithOAuth({ provider: provider });
        }
    },
    // ---------- Janelas (modais) ----------
    abrirModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    },
    fecharModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    },
    abrirCadastro() { this.abrirModal('modal-cadastro'); },
    abrirRecuperarSenha() { this.abrirModal('modal-recuperar'); },
    abrirAjuda() { this.abrirModal('modal-ajuda'); },

    // ---------- Criar conta ----------
    async criarConta(event) {
        event.preventDefault();
        const nomeSalao = document.getElementById('cad-nome-salao').value.trim();
        const email = document.getElementById('cad-email').value.trim();
        const senha = document.getElementById('cad-senha').value;
        const senha2 = document.getElementById('cad-senha2').value;

        if (senha !== senha2) {
            UI.showToast('As duas senhas precisam ser iguais.', 'error');
            return;
        }
        if (!supabaseClient) {
            UI.showToast('Não foi possível conectar ao servidor.', 'error');
            return;
        }

        try {
            const { data, error } = await supabaseClient.auth.signUp({ email, password: senha });
            if (error) {
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            if (!data.user) {
                UI.showToast('Não foi possível criar a conta. Tente novamente.', 'error');
                return;
            }

            // Cria o salão já com o nome escolhido (se a sessão existir na hora)
            if (data.session) {
                const { error: erroEstab } = await supabaseClient
                    .from('estabelecimentos')
                    .insert([{ user_id: data.user.id, nome_salao: nomeSalao, email, plano: 'gratis' }]);
                if (erroEstab) console.error('Erro ao criar salão:', erroEstab);
            } else {
                localStorage.setItem('hairconcept_nome_novo_salao', nomeSalao);
                UI.showToast('Conta criada! Confirme o e-mail que enviamos e depois entre.');
                this.fecharModal('modal-cadastro');
                return;
            }

            this.fecharModal('modal-cadastro');
            UI.showToast('Conta criada! Bem-vindo ao HairConcept.');
            const nome = nomeSalao;
            App.user = { loggedIn: true, role: 'admin', name: nome };
            App.finishLogin();
        } catch (e) {
            console.error('Erro ao criar conta:', e);
            UI.showToast('Erro inesperado ao criar a conta.', 'error');
        }
    },

    // ---------- Esqueci minha senha ----------
    async enviarRecuperacao(event) {
        event.preventDefault();
        const email = document.getElementById('rec-email').value.trim();
        if (!supabaseClient) {
            UI.showToast('Não foi possível conectar ao servidor.', 'error');
            return;
        }
        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });
            if (error) {
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            this.fecharModal('modal-recuperar');
            UI.showToast('Se esse e-mail estiver cadastrado, o link de recuperação já foi enviado.');
        } catch (e) {
            console.error('Erro ao pedir recuperação:', e);
            UI.showToast('Erro inesperado ao enviar o link.', 'error');
        }
    },

    // ---------- Salvar a senha nova (abre pelo link do e-mail) ----------
    async salvarNovaSenha(event) {
        event.preventDefault();
        const senha = document.getElementById('nova-senha').value;
        const senha2 = document.getElementById('nova-senha2').value;
        if (senha !== senha2) {
            UI.showToast('As duas senhas precisam ser iguais.', 'error');
            return;
        }
        if (!supabaseClient) {
            UI.showToast('Não foi possível conectar ao servidor.', 'error');
            return;
        }
        try {
            const { error } = await supabaseClient.auth.updateUser({ password: senha });
            if (error) {
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            this.fecharModal('modal-nova-senha');
            // Limpa o link de recuperação da barra de endereços
            window.history.replaceState({}, document.title, window.location.pathname);
            UI.showToast('Senha alterada com sucesso!');
            await App.verificarOuCriarEstabelecimento();
        } catch (e) {
            console.error('Erro ao salvar a senha:', e);
            UI.showToast('Erro inesperado ao salvar a senha.', 'error');
        }
    },

    // ---------- Pedido de ajuda do profissional ----------
    async enviarAjuda(event) {
        event.preventDefault();
        const nomeEstab = document.getElementById('ajuda-salao').value.trim();
        const nome = document.getElementById('ajuda-nome').value.trim();
        const cpf = document.getElementById('ajuda-cpf').value.trim();
        const tipo = document.getElementById('ajuda-tipo').value;
        const mensagem = document.getElementById('ajuda-mensagem').value.trim();

        if (!supabaseClient) {
            UI.showToast('Não foi possível conectar ao servidor.', 'error');
            return;
        }
        try {
            // Localiza o salão pelo nome para gravar o aviso junto dele
            let estabId = null;
            const { data: saloes, error: erroSalao } = await supabaseClient
                .from('estabelecimentos')
                .select('id')
                .ilike('nome_salao', nomeEstab)
                .limit(1);
            if (erroSalao) console.error('Erro ao procurar salão:', erroSalao);
            if (saloes && saloes.length > 0) estabId = saloes[0].id;

            const { error } = await supabaseClient.from('solicitacoes').insert([{
                estabelecimento_id: estabId,
                tipo: tipo,
                nome_pessoa: nome,
                nome_salao: nomeEstab,
                cpf: cpf,
                mensagem: mensagem
            }]);
            if (error) {
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            this.fecharModal('modal-ajuda');
            event.target.reset();
            UI.showToast('Pedido enviado! O salão vai falar com você.');
        } catch (e) {
            console.error('Erro ao enviar pedido:', e);
            UI.showToast('Erro inesperado ao enviar o pedido.', 'error');
        }
    },

    loginAdmin(event) {
        event.preventDefault();
        const email = document.getElementById('login-admin-email').value.trim();
        const password = document.getElementById('login-admin-senha').value.trim();
        if (supabaseClient) {
            supabaseClient.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
                if (error) {
                    console.error('Erro no login do admin:', error);
                    UI.showToast(mensagemAmigavel(error), 'error');
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
    logoBase64Temp: '',
    async init() {
        console.log("HairConcept inicializado.");

        // DETECTAR RETORNO DO MERCADO PAGO
        const urlParams = new URLSearchParams(window.location.search);
        const statusPagamento = urlParams.get('status') || urlParams.get('collection_status');
        
        if (statusPagamento === 'approved') {
            const estabId = localStorage.getItem('hairconcept_estab_id');
            const planoPago = localStorage.getItem('hairconcept_plan_pendente') || 'mensal';
            localStorage.setItem('hairconcept_plan', planoPago);
            localStorage.removeItem('hairconcept_plan_pendente');
            if (estabId && supabaseClient) {
                await supabaseClient.from('estabelecimentos').update({ plano: planoPago }).eq('id', estabId);
            }
            UI.showToast(`Pagamento aprovado! Plano ${planoPago === 'anual' ? 'Anual' : 'Mensal'} ativado com sucesso.`);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (statusPagamento === 'failure' || statusPagamento === 'cancelled') {
            UI.showToast('O pagamento não foi concluído. Mantendo plano grátis.', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput && !dataInput.value) {
            dataInput.value = dataLocalISO();
        }
        const ehProfissional = this.user.role === 'profissional';

        // Todo mundo precisa da agenda e das notas
        this.renderAgendaGrid();
        this.carregarPostIts();
        this.carregarRecadosEstabelecimento();
        this.proximaFrase();

        if (!ehProfissional) {
            // Só o salão carrega o resto (deixa o login do profissional leve)
            this.renderListaProfissionais();
            this.renderProdutos();
            this.renderServicos();
            this.popularSelectProfissionais();
            this.carregarConfiguracoes();
            this.renderRelatorios();
            this.renderAvaliacoes();
            this.carregarAvisos();
            this.renderClientes();
            this.renderRanking();
        }

        // Mostra ou esconde as partes conforme o perfil
        if (ehProfissional) {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
            this.carregarFechamento();
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
    mostrarBoasVindas(estab) {
        const nome = (estab && estab.nome_salao) || localStorage.getItem('hairconcept_nome_novo_salao') || 'Seu Salão';
        const el = document.getElementById('welcome-nome-salao');
        if (el) el.textContent = nome;

        const img = document.getElementById('welcome-logo-img');
        const icone = document.getElementById('welcome-logo-icon');
        const logo = estab && estab.logo_url;
        if (img && icone) {
            if (logo) {
                img.src = logo;
                img.classList.remove('hidden');
                icone.classList.add('hidden');
            } else {
                img.classList.add('hidden');
                icone.classList.remove('hidden');
            }
        }

        document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
        document.getElementById('aba-boasvindas')?.classList.remove('hidden');
    },

    concluirBoasVindas() {
        const id = this._userIdBoasVindas;
        if (id) localStorage.setItem('hairconcept_boasvindas_' + id, 'visto');
        this._userIdBoasVindas = null;
        this.init();
        UI.switchTab('aba-agenda');
    },

    async verificarOuCriarEstabelecimento() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return;
            const userId = session.user.id;
            
            let { data: estab, error } = await supabaseClient
                .from('estabelecimentos')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            const headerSub = document.getElementById('saloon-name-header');

            if (error || !estab) {
                const nomePadrao = localStorage.getItem('hairconcept_nome_novo_salao') || '';
                localStorage.removeItem('hairconcept_nome_novo_salao');
                const { data: newEstab, error: createErr } = await supabaseClient
                    .from('estabelecimentos')
                    .insert([{
                        user_id: userId,
                        nome_salao: nomePadrao,
                        email: session.user.email,
                        plano: 'gratis'
                    }])
                    .select()
                    .single();

                if (!createErr && newEstab) {
                    localStorage.setItem('hairconcept_estab_id', newEstab.id);
                    localStorage.setItem('hairconcept_plan', 'gratis');
                    if (headerSub) headerSub.textContent = newEstab.nome_salao;
                }
            } else {
                localStorage.setItem('hairconcept_estab_id', estab.id);
                if (estab.plano) {
                    localStorage.setItem('hairconcept_plan', estab.plano);
                }
                if (headerSub) headerSub.textContent = estab.nome_salao;
            }
            // Primeiro login: mostra o guia antes da agenda
            const jaViu = localStorage.getItem('hairconcept_boasvindas_' + userId);
            if (!jaViu) {
                this.mostrarBoasVindas(estab || null);
                // Só marca como visto depois que ele clicar em "Começar agora"
                this._userIdBoasVindas = userId;
            } else {
                this.init();
            }
        } catch (e) {
            console.error("Erro ao verificar estabelecimento:", e);
            this.init();
        }
    },
    async loginProfissional(event) {
        event.preventDefault();
        const nomeEstabelecimento = document.getElementById('login-prof-estabelecimento').value.trim();
        const cpf = document.getElementById('login-prof-id').value.trim();
        const senha = document.getElementById('login-prof-senha').value.trim();
        try {
            const { data: lista, error } = await supabaseClient.rpc('login_profissional', {
                p_salao: nomeEstabelecimento,
                p_cpf: cpf,
                p_senha: senha
            });
            const data = Array.isArray(lista) ? lista[0] : lista;
            if (error || !data || !data.id) {
                if (error) console.error('Erro no login do profissional:', error);
                UI.showToast('Estabelecimento, CPF ou senha incorretos.', 'error');
                return;
            }
            if (data.estabelecimento_id) {
                localStorage.setItem('hairconcept_estab_id', data.estabelecimento_id);
            }
            localStorage.setItem('hairconcept_prof_id', data.id);

            // Guarda só o necessário (o servidor não devolve CPF nem senha)
            const dadosProf = {
                id: data.id,
                nome: data.nome || '',
                cargo: data.cargo || '',
                foto_url: data.foto_url || '',
                estabelecimento_id: data.estabelecimento_id || '',
                nome_salao: data.nome_salao || nomeEstabelecimento
            };
            localStorage.setItem('hairconcept_prof_dados', JSON.stringify(dadosProf));

            // Autentica a conta interna dele (invisível): assim o banco sabe quem é
            const emailInterno = this.montarEmailInterno(cpf, dadosProf.estabelecimento_id);
            if (emailInterno && supabaseClient && supabaseClient.auth) {
                try {
                    const { error: erroAuth } = await supabaseClient.auth.signInWithPassword({
                        email: emailInterno,
                        password: senha
                    });
                    if (erroAuth) console.warn('Conta interna não autenticada:', erroAuth.message);
                } catch (e) {
                    console.warn('Erro ao autenticar a conta interna:', e);
                }
            }

            this.user = { loggedIn: true, role: 'profissional', name: dadosProf.nome, id: dadosProf.id };

            // O profissional também vê o nome e a logo do salão onde trabalha
            this.aplicarIdentidadeNoHeader(dadosProf.nome_salao, dadosProf.logo_url || null);
            if (dadosProf.estabelecimento_id) {
                this.carregarIdentidadeDoSalao(dadosProf.estabelecimento_id);
            }

            const elNome = document.getElementById('prof-header-nome');
            const elCargo = document.getElementById('prof-header-cargo');
            const elFoto = document.getElementById('prof-header-foto');
            if (elNome) elNome.textContent = dadosProf.nome;
            if (elCargo) elCargo.textContent = dadosProf.cargo;
            if (elFoto && dadosProf.foto_url) elFoto.src = dadosProf.foto_url;

            this.finishLogin(`Bem-vindo, ${dadosProf.nome}!`);
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
            // Garante o ID do salão: se o navegador ainda não tem, busca no banco agora.
            let idSalao = estabelecimentoId;
            if (!idSalao) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    const { data: estab, error: erroEstab } = await supabaseClient
                        .from('estabelecimentos')
                        .select('id')
                        .eq('user_id', session.user.id)
                        .maybeSingle();
                    if (erroEstab) console.error('Erro ao buscar o salão:', erroEstab);
                    if (estab) {
                        idSalao = estab.id;
                        localStorage.setItem('hairconcept_estab_id', estab.id);
                    }
                }
            }
            if (!idSalao) {
                UI.showToast('Não encontrei o seu salão. Recarregue a página e entre novamente.', 'error');
                return;
            }
            const { count, error: countError } = await supabaseClient
                .from('profissionais')
                .select('*', { count: 'exact', head: true })
                .eq('estabelecimento_id', idSalao);
            if (countError) throw countError;
            
            let limiteMaximo = 2;
            if (planoAtual === 'mensal') limiteMaximo = 10;
            if (planoAtual === 'anual') limiteMaximo = 50;

            if (count >= limiteMaximo) {
                UI.showToast(`Limite atingido! O plano atual permite apenas ${limiteMaximo} profissionais.`, 'error');
                return;
            }
            
            const nome = document.getElementById('prof-nome').value.trim();
            const cargo = document.getElementById('prof-cargo').value.trim();
            const cpf = (document.getElementById('prof-cpf').value || '').replace(/\D/g, '');
            const senha = document.getElementById('prof-senha').value;
            const foto_url = this.fotoBase64Temp || null;

            if (senha.length < 4) {
                UI.showToast('A senha precisa ter pelo menos 4 caracteres.', 'error');
                return;
            }

            // 1) Cria a conta interna PRIMEIRO, para gravar o profissional já ligado a ela
            const emailInterno = this.montarEmailInterno(cpf, idSalao);
            let userIdInterno = null;
            if (emailInterno) {
                // Cliente separado: criar a conta do profissional NAO pode trocar a sessao do salao
                const clienteIsolado = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'hc-cadastro-temp' }
                });
                const { data: conta, error: erroConta } = await clienteIsolado.auth.signUp({
                    email: emailInterno,
                    password: senha
                });
                if (erroConta) {
                    console.error('Conta interna nao criada:', erroConta.message);
                    UI.showToast('Nao consegui criar o acesso deste profissional. ' + mensagemAmigavel(erroConta), 'error');
                    return;
                }
                userIdInterno = (conta && conta.user && conta.user.id) ? conta.user.id : null;
            }

            // 2) O cadastro nunca morre: se o CPF ja existe no salao, reativamos a ficha
            const { data: jaExiste } = await supabaseClient
                .from('profissionais')
                .select('id, nome, ativo, user_id')
                .eq('estabelecimento_id', idSalao)
                .eq('cpf', cpf)
                .limit(1)
                .maybeSingle();

            let novoProf = null;
            let error = null;

            if (jaExiste && jaExiste.id) {
                if (jaExiste.ativo !== false) {
                    UI.showToast('Este CPF ja esta cadastrado e ativo na equipe: ' + (jaExiste.nome || '') + '.', 'error');
                    return;
                }
                if (!confirm('Profissional ja cadastrado: ' + (jaExiste.nome || '') + '\n\nDeseja reativar ele na equipe?\n\nOs dados e o historico serao mantidos.')) {
                    UI.showToast('Cadastro mantido como inativo. Nada foi alterado.');
                    return;
                }
                const atualizar = { nome: nome, cargo: cargo, foto_url: foto_url, ativo: true, estabelecimento: nomeEstabelecimentoHeader };
                if (userIdInterno) atualizar.user_id = userIdInterno;
                const res = await supabaseClient.from('profissionais').update(atualizar).eq('id', jaExiste.id).select();
                error = res.error; novoProf = res.data;
                if (!error) {
                    await supabaseClient.rpc('definir_senha_profissional', { p_id: jaExiste.id, p_senha: senha });
                    e.target.reset();
                    this.fotoBase64Temp = '';
                    this.renderListaProfissionais();
                    this.popularSelectProfissionais();
                    this.renderAgendaGrid();
                    UI.showToast('Profissional reativado! Ele ja esta na agenda com o historico dele.', 'success');
                    return;
                }
            } else {
                const res = await supabaseClient
                    .from('profissionais')
                    .insert([{
                        estabelecimento_id: idSalao,
                        estabelecimento: nomeEstabelecimentoHeader,
                        nome,
                        cargo,
                        cpf,
                        foto_url,
                        user_id: userIdInterno
                    }])
                    .select();
                error = res.error; novoProf = res.data;
            }

            if (error) throw error;
            if (!novoProf || novoProf.length === 0) {
                UI.showToast('Não foi possível criar o profissional. Tente novamente.', 'error');
                return;
            }

            // Grava a senha embaralhada pelo banco
            const { error: erroSenha } = await supabaseClient.rpc('definir_senha_profissional', {
                p_id: novoProf[0].id,
                p_senha: senha
            });
            if (erroSenha) {
                console.error('Erro ao definir a senha:', erroSenha);
                UI.showToast('Profissional criado, mas a senha falhou. Use "Trocar senha" na lista.', 'error');
            }

            e.target.reset();
            this.fotoBase64Temp = '';
            document.getElementById('preview-foto-prof').classList.add('hidden');
            document.getElementById('icon-foto-prof').classList.remove('hidden');
            this.renderListaProfissionais();
            this.popularSelectProfissionais();
        } catch (err) {
            if (err && err.code === '23505') {
                UI.showToast('Já existe um profissional com esse CPF. Apague o cadastro antigo ou use outro CPF.', 'error');
            } else {
                UI.showToast(mensagemAmigavel(err), 'error');
            }
        }
    },
    // Desativar / reativar: o cadastro do profissional NAO e apagado.
    async alternarAtivoProfissional(id, ativoAtual) {
        const vaiAtivar = !ativoAtual;
        const pergunta = vaiAtivar
            ? 'Colocar este profissional de volta na agenda? O cadastro e o historico serao mantidos.'
            : 'Tirar este profissional da agenda? O cadastro fica guardado e ele pode ser reativado pelo CPF.';
        if (!confirm(pergunta)) return;
        try {
            const { error } = await supabaseClient
                .from('profissionais')
                .update({ ativo: vaiAtivar })
                .eq('id', id);
            if (error) throw error;
            UI.showToast(vaiAtivar ? 'Profissional reativado! Ele ja esta na agenda.' : 'Profissional desativado. O cadastro foi mantido.');
            this.renderListaProfissionais();
            this.popularSelectProfissionais();
            this.renderAgendaGrid();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },

    async excluirProfissional(id) {
        if (!confirm("Excluir DEFINITIVAMENTE este profissional? Use apenas para cadastros criados por engano.")) return;
        try {
            const { error } = await supabaseClient
                .from('profissionais')
                .delete()
                .eq('id', id);
            if (error) throw error;
            UI.showToast('Cadastro excluido.');
            this.renderListaProfissionais();
            this.popularSelectProfissionais();
        } catch (e) {
            const msg = String(e && e.message ? e.message : e);
            if (msg.indexOf('23503') >= 0 || msg.toLowerCase().indexOf('foreign key') >= 0) {
                UI.showToast('Este profissional tem historico. Use DESATIVAR: o cadastro e os dados ficam guardados.', 'error');
            } else {
                UI.showToast(mensagemAmigavel(e), 'error');
            }
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
                UI.showToast('Foto de perfil atualizada e salva com sucesso!');
                this.renderListaProfissionais();
            } catch (err) {
                UI.showToast(mensagemAmigavel(err), 'error');
            }
        };
        reader.readAsDataURL(file);
    },
    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.logoBase64Temp = e.target.result;
            const preview = document.getElementById('preview-logo-salao');
            const icon = document.getElementById('icon-logo-salao');
            if (preview) {
                preview.src = this.logoBase64Temp;
                preview.classList.remove('hidden');
            }
            if (icon) icon.classList.add('hidden');
            // Mostra no cabeçalho já, antes mesmo de salvar
            this.aplicarLogoNoHeader(this.logoBase64Temp);
        };
        reader.readAsDataURL(file);
    },
    async enviarRecadoEstabelecimento() {
        const input = document.getElementById('prof-recado-input');
        const mensagem = input.value.trim();
        if (!mensagem) {
            UI.showToast('Escreva uma mensagem antes de enviar.', 'error');
            return;
        }
        const remetente = this.user.name || 'Profissional';
        const estabId = localStorage.getItem('hairconcept_estab_id');
        
        try {
            const { error } = await supabaseClient.from('recados').insert([{
                estabelecimento_id: estabId,
                remetente: remetente,
                mensagem: mensagem
            }]);
            if (error) throw error;
            input.value = '';
            this.carregarRecadosEstabelecimento();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },
    async carregarRecadosEstabelecimento() {
        const containerAdmin = document.getElementById('lista-recados-estab');
        const containerProf = document.getElementById('chat-historico-prof');
        const estabId = localStorage.getItem('hairconcept_estab_id');
        
        try {
            const { data, error } = await supabaseClient
                .from('recados')
                .select('*')
                .eq('estabelecimento_id', estabId)
                .order('created_at', { ascending: true });
                
            if (error) throw error;
            const mensagens = data || [];

            if (containerAdmin) {
                containerAdmin.innerHTML = mensagens.length > 0 ? [...mensagens].reverse().map(r => `
                    <div class="p-3 rounded-xl bg-zinc-900 border border-white/10 text-xs flex justify-between items-center gap-4">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-brand-500 font-bold uppercase">${r.remetente}:</span>
                                <span class="text-[9px] text-zinc-500">${new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <span class="text-zinc-200 mt-0.5 block">${r.mensagem}</span>
                        </div>
                        <button onclick="App.apagarRecado('${r.id}')" title="Apagar mensagem" class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 text-[10px] font-bold uppercase transition shrink-0 flex items-center gap-1">
                            <i class="fa-solid fa-trash"></i> Apagar
                        </button>
                    </div>
                `).join('') : '<p class="text-xs text-zinc-500">Nenhum recado recebido da equipe por enquanto.</p>';
            }

            if (containerProf) {
                containerProf.innerHTML = mensagens.length > 0 ? mensagens.map(r => {
                    const isEu = r.remetente.toLowerCase().includes((this.user.name || '').toLowerCase()) && !r.remetente.includes('Admin');
                    return `
                        <div class="flex flex-col ${isEu ? 'items-end' : 'items-start'} mb-2">
                            <span class="text-[9px] text-zinc-500 mb-0.5 px-1">${r.remetente} • ${new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <div class="p-3 rounded-2xl max-w-[85%] text-xs ${isEu ? 'bg-brand-500 text-white rounded-br-xs' : 'bg-zinc-900 border border-white/10 text-zinc-200 rounded-bl-xs'}">
                                ${r.mensagem}
                            </div>
                        </div>
                    `;
                }).join('') : '<p class="text-xs text-zinc-500 text-center py-4">Inicie uma conversa com o estabelecimento.</p>';
                containerProf.scrollTop = containerProf.scrollHeight;
            }
        } catch (e) {
            console.error(e);
        }
    },
    async apagarRecado(id) {
        try {
            const { error } = await supabaseClient.from('recados').delete().eq('id', id);
            if (error) throw error;
            UI.showToast("Mensagem apagada.", "success");
            this.carregarRecadosEstabelecimento();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), "error");
        }
    },
    async enviarRespostaAdmin() {
        const input = document.getElementById('admin-resposta-input');
        const mensagem = input.value.trim();
        if (!mensagem) {
            UI.showToast("Escreva uma resposta antes de enviar.", "error");
            return;
        }
        const estabId = localStorage.getItem('hairconcept_estab_id');
        
        try {
            const { error } = await supabaseClient.from('recados').insert([{
                estabelecimento_id: estabId,
                remetente: '👑 Salão (Admin)',
                mensagem: mensagem
            }]);
            if (error) throw error;
            UI.showToast("Resposta enviada!", "success");
            input.value = '';
            this.carregarRecadosEstabelecimento();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), "error");
        }
    },
       async excluirAgendamento(id, cliente) {
        if (!confirm('Desmarcar o atendimento de ' + (cliente || '') + '?')) return;
        try {
            const { error } = await supabaseClient.from('agendamentos').delete().eq('id', id);
            if (error) {
                console.error('Erro ao desmarcar:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            UI.showToast('Atendimento desmarcado.');
            this.renderAgendaGrid();
            this.renderRelatorios();
        } catch (e) {
            console.error('Erro inesperado ao desmarcar:', e);
            UI.showToast('Erro inesperado ao desmarcar.', 'error');
        }
    },

    async mudarStatusAgendamento(id, status) {
        try {
            const { error } = await supabaseClient
                .from('agendamentos')
                .update({ status: status })
                .eq('id', id);
            if (error) {
                console.error('Erro ao mudar o status:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            this.renderAgendaGrid();
        } catch (e) {
            console.error('Erro inesperado ao mudar status:', e);
            UI.showToast('Erro inesperado ao mudar o estado.', 'error');
        }
    },

    // ========== CLIENTES ==========
    // ===== Votos e estrelas =====
    abrirVoto(clienteId, clienteNome) {
        const cId = document.getElementById('voto-cliente-id');
        const cNome = document.getElementById('voto-cliente-nome');
        const tipo = document.getElementById('voto-tipo');
        const obs = document.getElementById('voto-obs');
        if (cId) cId.value = clienteId;
        if (cNome) cNome.textContent = clienteNome || '';
        if (tipo) tipo.value = 'mais';
        if (obs) obs.value = '';
        this.preencherSelectProfissionaisVoto();
        Auth.abrirModal('modal-voto');
    },

    async preencherSelectProfissionaisVoto() {
        const sel = document.getElementById('voto-profissional');
        if (!sel) return;
        const estabId = await this.obterEstabId();
        if (!estabId) return;
        try {
            const { data, error } = await supabaseClient
                .from('profissionais')
                .select('id, nome')
                .eq('estabelecimento_id', estabId);
            if (error) { console.warn('Erro ao buscar profissionais:', error.message); return; }
            sel.innerHTML = '';
            const op = document.createElement('option');
            op.value = '';
            op.textContent = 'Nenhum / so sobre a cliente';
            sel.appendChild(op);
            (data || []).forEach(function (p) {
                const o = document.createElement('option');
                o.value = p.id;
                o.textContent = p.nome || '';
                sel.appendChild(o);
            });
        } catch (e) {
            console.warn('Erro ao preencher profissionais do voto:', e);
        }
    },

    async salvarVoto(event) {
        event.preventDefault();
        const clienteId = document.getElementById('voto-cliente-id')?.value;
        const tipo = document.getElementById('voto-tipo')?.value || 'mais';
        const profId = document.getElementById('voto-profissional')?.value || null;
        const obs = document.getElementById('voto-obs')?.value.trim() || null;

        if (!clienteId) { UI.showToast('Cliente nao identificada.', 'error'); return; }
        const estabId = await this.obterEstabId();
        if (!estabId) { UI.showToast('Nao encontrei o seu salao. Recarregue a pagina.', 'error'); return; }

        try {
            const { error } = await supabaseClient.from('avaliacoes_cliente').insert([{
                estabelecimento_id: estabId,
                cliente_id: clienteId,
                profissional_id: profId,
                tipo: tipo,
                obs: obs
            }]);
            if (error) {
                console.error('Erro ao registrar voto:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            Auth.fecharModal('modal-voto');
            UI.showToast(tipo === 'mais' ? 'Ponto registrado!' : 'Alerta registrado.');
            this.renderClientes();
            this.renderRanking();
        } catch (e) {
            console.error('Erro inesperado ao votar:', e);
            UI.showToast('Erro inesperado ao registrar.', 'error');
        }
    },

    // Estrelas do profissional: proporcional ao total de clientes do salao
    calcularEstrelaProf(pontos, totalClientes) {
        const base = totalClientes > 0 ? totalClientes : 1;
        const progresso = Math.min(pontos / base, 1);
        const cheias = Math.floor(progresso * 5);
        const resto = (progresso * 5) - cheias;
        return { pontos: pontos, total: base, progresso: progresso, cheias: cheias, meia: resto >= 0.5, vazias: 5 - cheias - (resto >= 0.5 ? 1 : 0) };
    },

    async renderRankingGestao() {
        const container = document.getElementById('ranking-gestao');
        const totalEl = document.getElementById('aval-total-clientes');
        if (!container) return;
        const estabId = await this.obterEstabId();
        if (!estabId) return;
        try {
            const { data: profs } = await supabaseClient
                .from('profissionais').select('id, nome, cargo')
                .eq('estabelecimento_id', estabId);
            const { data: votos } = await supabaseClient
                .from('avaliacoes_cliente').select('profissional_id, tipo')
                .eq('estabelecimento_id', estabId);
            const { count } = await supabaseClient
                .from('clientes').select('*', { count: 'exact', head: true })
                .eq('estabelecimento_id', estabId);
            const total = count || 0;
            if (totalEl) totalEl.textContent = total + ' cliente(s) na base';

            const pontos = {};
            (votos || []).forEach(function (v) {
                if (!v.profissional_id || v.tipo !== 'mais') return;
                pontos[v.profissional_id] = (pontos[v.profissional_id] || 0) + 1;
            });

            const lista = (profs || []).map(function (p) {
                return { p: p, pontos: pontos[p.id] || 0 };
            }).sort(function (a, b) { return b.pontos - a.pontos; });

            container.innerHTML = '';
            if (lista.length === 0) {
                const m = document.createElement('p');
                m.className = 'text-xs text-zinc-500';
                m.textContent = 'Nenhum profissional cadastrado ainda.';
                container.appendChild(m);
                return;
            }

            lista.forEach(function (item) {
                const est = App.calcularEstrelaProf(item.pontos, total);
                const card = document.createElement('div');
                card.className = 'p-3.5 rounded-2xl bg-zinc-950 border border-white/10 space-y-2';

                const topo = document.createElement('div');
                topo.className = 'flex items-center justify-between gap-3';
                const info = document.createElement('div');
                const nome = document.createElement('h4');
                nome.className = 'text-xs font-bold text-white uppercase';
                nome.textContent = item.p.nome || '';
                const cargo = document.createElement('p');
                cargo.className = 'text-[10px] text-brand-500';
                cargo.textContent = item.p.cargo || '';
                info.appendChild(nome); info.appendChild(cargo);

                const dir = document.createElement('div');
                dir.className = 'text-right';
                const estrelas = document.createElement('div');
                estrelas.className = 'prof-estrelas';
                for (let i = 0; i < est.cheias; i++) estrelas.innerHTML += '<i class="fa-solid fa-star"></i>';
                if (est.meia) estrelas.innerHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
                for (let i = 0; i < est.vazias; i++) estrelas.innerHTML += '<i class="fa-regular fa-star text-zinc-600"></i>';
                const cont = document.createElement('span');
                cont.className = 'block text-[9px] text-zinc-500 mt-0.5';
                cont.textContent = item.pontos + ' de ' + total + ' cliente(s)';
                dir.appendChild(estrelas); dir.appendChild(cont);
                topo.appendChild(info); topo.appendChild(dir);

                const barra = document.createElement('div');
                barra.className = 'prof-barra';
                const cheia = document.createElement('div');
                cheia.className = 'prof-barra-cheia';
                cheia.style.width = Math.round(est.progresso * 100) + '%';
                barra.appendChild(cheia);

                card.appendChild(topo); card.appendChild(barra);
                container.appendChild(card);
            });
        } catch (e) {
            console.warn('Erro ao montar a avaliacao:', e);
        }
    },

    async renderRanking() {
        const container = document.getElementById('ranking-profissionais');
        const totalEl = document.getElementById('ranking-total-clientes');
        if (!container) return;
        const estabId = await this.obterEstabId();
        if (!estabId) return;

        try {
            const { data: profs, error: e1 } = await supabaseClient
                .from('profissionais').select('id, nome, cargo, foto_url')
                .eq('estabelecimento_id', estabId);
            if (e1) { console.warn('Erro ao buscar equipe:', e1.message); return; }

            const { data: votos } = await supabaseClient
                .from('avaliacoes_cliente').select('profissional_id, tipo')
                .eq('estabelecimento_id', estabId);

            const { count: totalClientes } = await supabaseClient
                .from('clientes').select('*', { count: 'exact', head: true })
                .eq('estabelecimento_id', estabId);

            const total = totalClientes || 0;
            if (totalEl) totalEl.textContent = total + ' cliente(s) na base';

            const pontosPorProf = {};
            (votos || []).forEach(function (v) {
                if (!v.profissional_id || v.tipo !== 'mais') return;
                pontosPorProf[v.profissional_id] = (pontosPorProf[v.profissional_id] || 0) + 1;
            });

            const lista = (profs || []).map(function (p) {
                return { p: p, pontos: pontosPorProf[p.id] || 0 };
            }).sort(function (a, b) { return b.pontos - a.pontos; });

            container.innerHTML = '';
            if (lista.length === 0) {
                const msg = document.createElement('p');
                msg.className = 'text-xs text-zinc-500';
                msg.textContent = 'Nenhum profissional cadastrado ainda.';
                container.appendChild(msg);
                return;
            }

            lista.forEach(function (item) {
                const est = App.calcularEstrelaProf(item.pontos, total);

                const card = document.createElement('div');
                card.className = 'p-3.5 rounded-2xl bg-zinc-950 border border-white/10 space-y-2';

                const topo = document.createElement('div');
                topo.className = 'flex items-center justify-between gap-3';

                const info = document.createElement('div');
                const nome = document.createElement('h4');
                nome.className = 'text-xs font-bold text-white uppercase';
                nome.textContent = item.p.nome || '';
                const cargo = document.createElement('p');
                cargo.className = 'text-[10px] text-brand-500';
                cargo.textContent = item.p.cargo || '';
                info.appendChild(nome); info.appendChild(cargo);

                const dir = document.createElement('div');
                dir.className = 'text-right';
                const estrelas = document.createElement('div');
                estrelas.className = 'prof-estrelas';
                for (let i = 0; i < est.cheias; i++) estrelas.innerHTML += '<i class="fa-solid fa-star"></i>';
                if (est.meia) estrelas.innerHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
                for (let i = 0; i < est.vazias; i++) estrelas.innerHTML += '<i class="fa-regular fa-star text-zinc-600"></i>';
                const contagem = document.createElement('span');
                contagem.className = 'block text-[9px] text-zinc-500 mt-0.5';
                contagem.textContent = item.pontos + ' de ' + total + ' cliente(s)';
                dir.appendChild(estrelas); dir.appendChild(contagem);

                topo.appendChild(info); topo.appendChild(dir);

                const barra = document.createElement('div');
                barra.className = 'prof-barra';
                const cheia = document.createElement('div');
                cheia.className = 'prof-barra-cheia';
                cheia.style.width = Math.round(est.progresso * 100) + '%';
                barra.appendChild(cheia);

                card.appendChild(topo);
                card.appendChild(barra);
                container.appendChild(card);
            });
        } catch (e) {
            console.warn('Erro ao montar o ranking:', e);
        }
    },

    async renderClientes() {
        const lista = document.getElementById('lista-clientes');
        const total = document.getElementById('clientes-total');
        if (!lista) return;

        const busca = (document.getElementById('busca-clientes')?.value || '').trim();
        const estabId = await this.obterEstabId();
        if (!estabId) { lista.textContent = 'Não encontrei o seu salão. Recarregue a página.'; return; }

        try {
            const { data, error } = await supabaseClient
                .from('clientes')
                .select('*')
                .eq('estabelecimento_id', estabId)
                .order('nome', { ascending: true });

            if (error) {
                console.error('Erro ao buscar clientes:', error);
                lista.textContent = 'Não foi possível carregar os clientes agora.';
                return;
            }

            // Votos de cada cliente (uso interno do salao)
            let votos = [];
            try {
                const { data: v } = await supabaseClient
                    .from('avaliacoes_cliente')
                    .select('cliente_id, tipo')
                    .eq('estabelecimento_id', estabId);
                votos = v || [];
            } catch (e) {
                console.warn('Nao foi possivel carregar os votos:', e);
            }
            const saldo = {};
            votos.forEach(function (v) {
                if (!saldo[v.cliente_id]) saldo[v.cliente_id] = { mais: 0, menos: 0 };
                if (v.tipo === 'mais') saldo[v.cliente_id].mais++;
                else saldo[v.cliente_id].menos++;
            });

            let clientes = data || [];
            const digitosBusca = busca.replace(/\D/g, '');
            if (busca) {
                const alvo = busca.toLowerCase();
                clientes = clientes.filter(function (c) {
                    const nomeOk = (c.nome || '').toLowerCase().indexOf(alvo) >= 0;
                    const telOk = digitosBusca && String(c.telefone || '').replace(/\D/g, '').indexOf(digitosBusca) >= 0;
                    const cpfOk = digitosBusca && String(c.cpf || '').replace(/\D/g, '').indexOf(digitosBusca) >= 0;
                    const emailOk = (c.email || '').toLowerCase().indexOf(alvo) >= 0;
                    return nomeOk || telOk || cpfOk || emailOk;
                });
            }

            if (total) {
                total.textContent = clientes.length === 1 ? '1 cliente' : clientes.length + ' clientes';
            }

            lista.innerHTML = '';
            if (clientes.length === 0) {
                const p = document.createElement('p');
                p.className = 'text-xs text-zinc-500';
                p.textContent = busca
                    ? 'Nenhum cliente encontrado para esta busca.'
                    : 'Nenhum cliente cadastrado ainda. Adicione o primeiro acima.';
                lista.appendChild(p);
                return;
            }

            clientes.forEach((c) => {
                const s = saldo[c.id] || { mais: 0, menos: 0 };
                const alerta = (s.menos - s.mais) > 0;
                const boa = (s.mais - s.menos) > 0;

                const card = document.createElement('div');
                card.className = 'p-3.5 rounded-2xl bg-zinc-950 border space-y-2 ' + (alerta ? 'cli-alerta' : (boa ? 'cli-boa' : 'border-white/10'));

                const topo = document.createElement('div');
                topo.className = 'flex items-start justify-between gap-3';

                const info = document.createElement('div');
                const nome = document.createElement('h4');
                nome.className = 'text-xs font-bold text-white uppercase';
                nome.textContent = c.nome || '';
                const contato = document.createElement('p');
                contato.className = 'text-[10px] text-zinc-400';
                contato.textContent = [c.telefone, c.cpf, c.email].filter(Boolean).join(' • ');
                info.appendChild(nome); info.appendChild(contato);

                // Votos: estrela amarela para cliente boa, vermelha para alerta
                const linhaVotos = document.createElement('div');
                linhaVotos.className = 'cli-votos mt-1';
                const icone = document.createElement('i');
                icone.className = alerta
                    ? 'fa-solid fa-star cli-estrela-vermelha'
                    : (boa ? 'fa-solid fa-star cli-estrela-amarela' : 'fa-regular fa-star text-zinc-600');
                const mais = document.createElement('span');
                mais.className = 'cli-mais';
                mais.textContent = '+' + s.mais;
                const menos = document.createElement('span');
                menos.className = 'cli-menos';
                menos.textContent = '-' + s.menos;
                linhaVotos.appendChild(icone);
                linhaVotos.appendChild(mais);
                linhaVotos.appendChild(menos);
                if (alerta) {
                    const aviso = document.createElement('span');
                    aviso.className = 'cli-menos uppercase font-bold ml-1';
                    aviso.textContent = 'cuidado';
                    linhaVotos.appendChild(aviso);
                }
                info.appendChild(linhaVotos);

                if (c.obs_interna) {
                    const obs = document.createElement('p');
                    obs.className = 'cli-obs';
                    obs.textContent = c.obs_interna;
                    info.appendChild(obs);
                }
                topo.appendChild(info);
                card.appendChild(topo);

                const acoes = document.createElement('div');
                acoes.className = 'flex items-center gap-2 flex-wrap';

                if (c.telefone) {
                    const btnZap = document.createElement('a');
                    btnZap.className = 'px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold uppercase transition';
                    btnZap.href = 'https://wa.me/55' + String(c.telefone).replace(/\D/g, '');
                    btnZap.target = '_blank';
                    btnZap.innerHTML = '<i class="fa-brands fa-whatsapp"></i> WhatsApp';
                    acoes.appendChild(btnZap);
                }
                if (c.email) {
                    const btnMail = document.createElement('a');
                    btnMail.className = 'px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-[10px] font-bold uppercase transition';
                    btnMail.href = 'mailto:' + c.email;
                    btnMail.innerHTML = '<i class="fa-solid fa-envelope"></i> E-mail';
                    acoes.appendChild(btnMail);
                }

                const btnMais = document.createElement('button');
                btnMais.className = 'px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold uppercase transition cursor-pointer';
                btnMais.textContent = '+1';
                btnMais.onclick = () => this.abrirVoto(c.id, c.nome);
                acoes.appendChild(btnMais);

                const btnMenos = document.createElement('button');
                btnMenos.className = 'px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-[10px] font-bold uppercase transition cursor-pointer';
                btnMenos.textContent = '-1';
                btnMenos.onclick = () => this.abrirVoto(c.id, c.nome);
                acoes.appendChild(btnMenos);

                const btnEditar = document.createElement('button');
                btnEditar.className = 'px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-300 hover:bg-zinc-800 text-[10px] font-bold uppercase transition cursor-pointer';
                btnEditar.textContent = 'Editar';
                btnEditar.onclick = () => this.abrirEditarCliente(c.id, c.nome, c.telefone, c.cpf, c.email);
                acoes.appendChild(btnEditar);

                const btnExcluir = document.createElement('button');
                btnExcluir.className = 'px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-[10px] font-bold uppercase transition cursor-pointer';
                btnExcluir.textContent = 'Excluir';
                btnExcluir.onclick = () => this.excluirCliente(c.id);
                acoes.appendChild(btnExcluir);

                card.appendChild(acoes);
                lista.appendChild(card);
            });
        } catch (e) {
            console.error('Erro inesperado ao listar clientes:', e);
            lista.textContent = 'Não foi possível carregar os clientes agora.';
        }
    },

    async handleCreateCliente(event) {
        event.preventDefault();
        const nome = document.getElementById('cli-nome').value.trim();
        const telefone = document.getElementById('cli-telefone').value.trim();
        const cpf = document.getElementById('cli-cpf').value.trim();
        const email = document.getElementById('cli-email').value.trim();

        if (!nome) {
            UI.showToast('Escreva o nome do cliente.', 'error');
            return;
        }

        const estabId = await this.obterEstabId();
        if (!estabId) {
            UI.showToast('Não encontrei o seu salão. Recarregue a página.', 'error');
            return;
        }

        try {
            // Evita duplicar: procura pelo telefone ou CPF antes de gravar
            const { data: existentes, error: erroBusca } = await supabaseClient
                .from('clientes')
                .select('id, nome, telefone, cpf')
                .eq('estabelecimento_id', estabId);
            if (erroBusca) console.warn('Não foi possível conferir duplicados:', erroBusca.message);

            const telLimpo = telefone.replace(/\D/g, '');
            const cpfLimpo = cpf.replace(/\D/g, '');
            const repetido = (existentes || []).find(function (c) {
                const telIgual = telLimpo && String(c.telefone || '').replace(/\D/g, '') === telLimpo;
                const cpfIgual = cpfLimpo && String(c.cpf || '').replace(/\D/g, '') === cpfLimpo;
                return telIgual || cpfIgual;
            });

            if (repetido) {
                UI.showToast('Esse contato já está cadastrado: ' + repetido.nome, 'error');
                return;
            }

            const { error } = await supabaseClient.from('clientes').insert([{
                estabelecimento_id: estabId,
                nome: nome,
                telefone: telefone || null,
                cpf: cpf || null,
                email: email || null
            }]);
            if (error) {
                console.error('Erro ao criar cliente:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }

            UI.showToast('Cliente adicionado!');
            document.getElementById('cli-nome').value = '';
            document.getElementById('cli-telefone').value = '';
            document.getElementById('cli-cpf').value = '';
            document.getElementById('cli-email').value = '';
            this.renderClientes();
        } catch (e) {
            console.error('Erro inesperado ao criar cliente:', e);
            UI.showToast('Erro inesperado ao salvar o cliente.', 'error');
        }
    },

    abrirEditarCliente(id, nome, telefone, cpf, email) {
        const campoId = document.getElementById('editar-cli-id');
        if (campoId) campoId.value = id;
        const n = document.getElementById('editar-cli-nome');
        const t = document.getElementById('editar-cli-telefone');
        const c = document.getElementById('editar-cli-cpf');
        const m = document.getElementById('editar-cli-email');
        if (n) n.value = nome || '';
        if (t) t.value = telefone || '';
        if (c) c.value = cpf || '';
        if (m) m.value = email || '';
        Auth.abrirModal('modal-editar-cliente');
    },

    async salvarEdicaoCliente(event) {
        event.preventDefault();
        const id = document.getElementById('editar-cli-id').value;
        const nome = document.getElementById('editar-cli-nome').value.trim();
        const telefone = document.getElementById('editar-cli-telefone').value.trim();
        const cpf = document.getElementById('editar-cli-cpf').value.trim();
        const email = document.getElementById('editar-cli-email').value.trim();

        if (!id) { UI.showToast('Cliente não identificado. Feche e tente de novo.', 'error'); return; }

        try {
            const { data, error } = await supabaseClient
                .from('clientes')
                .update({ nome: nome, telefone: telefone || null, cpf: cpf || null, email: email || null })
                .eq('id', id)
                .select('id');
            if (error) {
                console.error('Erro ao editar cliente:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            if (!data || data.length === 0) {
                UI.showToast('Nenhum cliente foi atualizado. Confira se você está no salão certo.', 'error');
                return;
            }
            Auth.fecharModal('modal-editar-cliente');
            UI.showToast('Cliente atualizado!');
            this.renderClientes();
        } catch (e) {
            console.error('Erro inesperado ao editar cliente:', e);
            UI.showToast('Erro inesperado ao salvar o cliente.', 'error');
        }
    },

    async excluirCliente(id) {
        if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
        try {
            const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
            if (error) {
                console.error('Erro ao excluir cliente:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            UI.showToast('Cliente excluído.');
            this.renderClientes();
        } catch (e) {
            console.error('Erro inesperado ao excluir cliente:', e);
            UI.showToast('Erro inesperado ao excluir.', 'error');
        }
    },

    // ---------- Trocar senha do profissional ----------
    abrirTrocarSenhaProfissional(id, nome, cpf) {
        const campoId = document.getElementById('trocasenha-prof-id');
        const campoNome = document.getElementById('trocasenha-prof-nome');
        const campoCpf = document.getElementById('trocasenha-prof-cpf');
        const s1 = document.getElementById('trocasenha-senha');
        const s2 = document.getElementById('trocasenha-senha2');
        if (campoId) campoId.value = id;
        if (campoNome) campoNome.textContent = nome;
        if (campoCpf) campoCpf.value = cpf || '';
        if (s1) s1.value = '';
        if (s2) s2.value = '';
        Auth.abrirModal('modal-trocar-senha');
    },

    async salvarNovaSenhaProfissional(event) {
        event.preventDefault();
        const id = document.getElementById('trocasenha-prof-id').value;
        const senha = document.getElementById('trocasenha-senha').value;
        const senha2 = document.getElementById('trocasenha-senha2').value;

        if (!id) {
            UI.showToast('Profissional não identificado. Feche e tente de novo.', 'error');
            return;
        }
        if (senha !== senha2) {
            UI.showToast('As duas senhas precisam ser iguais.', 'error');
            return;
        }
        if (!supabaseClient) {
            UI.showToast('Não foi possível conectar ao servidor.', 'error');
            return;
        }
        try {
            const { error } = await supabaseClient.rpc('definir_senha_profissional', {
                p_id: id,
                p_senha: senha
            });

            if (error) {
                console.error('Erro ao trocar senha:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }

            // (a conta interna é atualizada pelo banco; não mexe na sessão do salão)
            Auth.fecharModal('modal-trocar-senha');
            UI.showToast('Senha alterada! Passe a senha nova para o profissional.');
        } catch (e) {
            console.error('Erro inesperado ao trocar senha:', e);
            UI.showToast('Erro inesperado ao salvar a senha.', 'error');
        }
    },

    // ---------- Editar profissional ----------
    abrirEditarProfissional(id, nome, cargo, cpf) {
        const campoId = document.getElementById('editar-prof-id');
        if (campoId) campoId.value = id;
        const campoNome = document.getElementById('editar-prof-nome');
        const campoCargo = document.getElementById('editar-prof-cargo');
        const campoCpf = document.getElementById('editar-prof-cpf');
        if (campoNome) campoNome.value = nome || '';
        if (campoCargo) campoCargo.value = cargo || '';
        if (campoCpf) campoCpf.value = cpf || '';
        Auth.abrirModal('modal-editar-prof');
    },

    async salvarEdicaoProfissional(event) {
        event.preventDefault();
        const id = document.getElementById('editar-prof-id').value;
        const nome = document.getElementById('editar-prof-nome').value.trim();
        const cargo = document.getElementById('editar-prof-cargo').value.trim();
        const cpf = document.getElementById('editar-prof-cpf').value.trim();

        if (!id) {
            UI.showToast('Profissional não identificado. Feche e tente de novo.', 'error');
            return;
        }
        if (!supabaseClient) {
            UI.showToast('Não foi possível conectar ao servidor.', 'error');
            return;
        }
        try {
            const { data, error } = await supabaseClient
                .from('profissionais')
                .update({ nome: nome, cargo: cargo, cpf: cpf })
                .eq('id', id)
                .select('id');

            if (error) {
                console.error('Erro ao editar profissional:', error);
                if (error.code === '23505') {
                    UI.showToast('Já existe um profissional com esse CPF.', 'error');
                } else {
                    UI.showToast(mensagemAmigavel(error), 'error');
                }
                return;
            }
            if (!data || data.length === 0) {
                UI.showToast('Nenhum profissional foi atualizado. Confira se você está no salão certo.', 'error');
                return;
            }
            Auth.fecharModal('modal-editar-prof');
            UI.showToast('Dados do profissional atualizados!');
            this.renderListaProfissionais();
            this.popularSelectProfissionais();
        } catch (e) {
            console.error('Erro inesperado ao editar:', e);
            UI.showToast('Erro inesperado ao salvar os dados.', 'error');
        }
    },

    // ---------- Avisos e pedidos dos clientes ----------
    async carregarAvisos() {
        const container = document.getElementById('lista-avisos');
        if (!container) return;
        const estabId = localStorage.getItem('hairconcept_estab_id');

        try {
            const { data, error } = await supabaseClient
                .from('solicitacoes')
                .select('*')
                .eq('estabelecimento_id', estabId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao carregar avisos:', error);
                container.textContent = 'Não foi possível carregar os avisos agora.';
                return;
            }

            const avisos = data || [];
            this.atualizarBadgeAvisos(avisos);

            container.innerHTML = '';
            if (avisos.length === 0) {
                const p = document.createElement('p');
                p.className = 'text-xs text-zinc-500';
                p.textContent = 'Nenhum aviso ou pedido por enquanto.';
                container.appendChild(p);
                return;
            }

            const rotulos = {
                esqueci_senha: 'Esqueci minha senha',
                reclamacao: 'Reclamação',
                excluir_dados: 'Excluir meus dados',
                outro: 'Outro assunto'
            };

            avisos.forEach(a => {
                const item = document.createElement('div');
                item.className = 'aviso-item' + (a.resolvido ? ' resolvido' : '');

                const linhaTopo = document.createElement('div');
                linhaTopo.className = 'flex items-center justify-between gap-3 flex-wrap';

                const rotulo = document.createElement('span');
                rotulo.className = 'text-[10px] font-bold uppercase text-brand-500';
                rotulo.textContent = rotulos[a.tipo] || a.tipo;

                const dataTexto = document.createElement('span');
                dataTexto.className = 'text-[10px] text-zinc-500';
                dataTexto.textContent = a.created_at ? new Date(a.created_at).toLocaleString('pt-BR') : '';

                linhaTopo.appendChild(rotulo);
                linhaTopo.appendChild(dataTexto);

                const quem = document.createElement('p');
                quem.className = 'text-xs text-white font-bold mt-2';
                quem.textContent = (a.nome_pessoa || 'Sem nome') + ' — ' + (a.nome_salao || '') + (a.cpf ? ' — CPF ' + a.cpf : '');

                const msg = document.createElement('p');
                msg.className = 'text-xs text-zinc-300 mt-1';
                msg.textContent = a.mensagem || '';

                const acoes = document.createElement('div');
                acoes.className = 'flex gap-2 mt-3';

                const btnResolver = document.createElement('button');
                btnResolver.className = 'px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase hover:bg-emerald-500/20 transition';
                btnResolver.textContent = a.resolvido ? 'Reabrir' : 'Marcar como resolvido';
                btnResolver.onclick = () => this.marcarAviso(a.id, !a.resolvido);

                const btnExcluir = document.createElement('button');
                btnExcluir.className = 'px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold uppercase hover:bg-red-500/20 transition';
                btnExcluir.textContent = 'Excluir';
                btnExcluir.onclick = () => this.excluirAviso(a.id);

                acoes.appendChild(btnResolver);

                // Se for pedido de senha, oferece o atalho para trocar direto
                if (a.tipo === 'esqueci_senha') {
                    const btnTrocar = document.createElement('button');
                    btnTrocar.className = 'px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-500 border border-brand-500/20 text-[10px] font-bold uppercase hover:bg-brand-500/20 transition';
                    btnTrocar.textContent = 'Trocar senha deste profissional';
                    btnTrocar.onclick = async () => {
                        const cpfLimpo = String(a.cpf || '').replace(/\D/g, '');
                        if (!cpfLimpo) {
                            UI.showToast('O aviso não trouxe CPF. Procure na aba Equipe.', 'error');
                            return;
                        }
                        try {
                            const { data, error } = await supabaseClient
                                .from('profissionais')
                                .select('id, nome, cpf')
                                .eq('estabelecimento_id', localStorage.getItem('hairconcept_estab_id'));
                            if (error) {
                                console.error('Erro ao buscar profissionais:', error);
                                UI.showToast('Não foi possível buscar o profissional. Use a aba Equipe.', 'error');
                                return;
                            }
                            const achado = (data || []).find(p => String(p.cpf || '').replace(/\D/g, '') === cpfLimpo);
                            if (!achado) {
                                UI.showToast('Não achei nenhum profissional com esse CPF. Procure na aba Equipe.', 'error');
                                return;
                            }
                            this.abrirTrocarSenhaProfissional(achado.id, achado.nome, achado.cpf);
                        } catch (e) {
                            console.error('Erro ao abrir troca de senha pelo aviso:', e);
                            UI.showToast('Erro inesperado ao abrir a troca de senha.', 'error');
                        }
                    };
                    acoes.appendChild(btnTrocar);
                }

                acoes.appendChild(btnExcluir);

                item.appendChild(linhaTopo);
                item.appendChild(quem);
                item.appendChild(msg);
                item.appendChild(acoes);
                container.appendChild(item);
            });
        } catch (e) {
            console.error('Erro inesperado ao carregar avisos:', e);
            container.textContent = 'Não foi possível carregar os avisos agora.';
        }
    },

    atualizarBadgeAvisos(avisos) {
        const badge = document.getElementById('badge-avisos');
        if (!badge) return;
        const pendentes = (avisos || []).filter(a => !a.resolvido).length;
        if (pendentes > 0) {
            badge.textContent = String(pendentes);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    async marcarAviso(id, resolvido) {
        try {
            const { error } = await supabaseClient
                .from('solicitacoes')
                .update({ resolvido: resolvido })
                .eq('id', id);
            if (error) {
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            this.carregarAvisos();
        } catch (e) {
            console.error('Erro ao marcar aviso:', e);
            UI.showToast('Erro inesperado ao atualizar o aviso.', 'error');
        }
    },

    async excluirAviso(id) {
        if (!confirm('Tem certeza que deseja excluir este aviso?')) return;
        try {
            const { error } = await supabaseClient.from('solicitacoes').delete().eq('id', id);
            if (error) {
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            UI.showToast('Aviso excluído.');
            this.carregarAvisos();
        } catch (e) {
            console.error('Erro ao excluir aviso:', e);
            UI.showToast('Erro inesperado ao excluir o aviso.', 'error');
        }
    },

    async popularSelectProfissionais() {
        const select = document.getElementById('agendamento-profissional');
        if (!select) return;
        try {
            let estabId = localStorage.getItem('hairconcept_estab_id');

            if (!estabId && supabaseClient && supabaseClient.auth) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    const { data: estab } = await supabaseClient
                        .from('estabelecimentos')
                        .select('id')
                        .eq('user_id', session.user.id)
                        .maybeSingle();
                    if (estab) {
                        estabId = estab.id;
                        localStorage.setItem('hairconcept_estab_id', estab.id);
                    }
                }
            }

            const { data, error } = await supabaseClient
                .from('profissionais')
                .select('id, nome')
                .eq('estabelecimento_id', estabId);

            if (error) {
                console.error('Erro ao buscar profissionais:', error);
                return;
            }

            select.innerHTML = '';
            if (data && data.length > 0) {
                data.forEach(p => {
                    const op = document.createElement('option');
                    op.value = p.id;
                    op.textContent = p.nome;
                    select.appendChild(op);
                });
            } else {
                const op = document.createElement('option');
                op.value = '';
                op.textContent = 'Cadastre um profissional na aba Equipe';
                select.appendChild(op);
            }
        } catch (e) {
            console.error(e);
        }
    },

    async carregarIdentidadeDoSalao(estabId) {
        // O profissional não carrega as configurações, então busca só a identidade
        if (!estabId || !supabaseClient) return;
        try {
            const { data, error } = await supabaseClient
                .from('estabelecimentos')
                .select('nome_salao, logo_url')
                .eq('id', estabId)
                .maybeSingle();
            if (error) { console.warn('Não foi possível carregar a identidade do salão:', error.message); return; }
            if (data) {
                App.aplicarIdentidadeNoHeader(data.nome_salao, data.logo_url || null);
                const salvo = JSON.parse(localStorage.getItem('hairconcept_prof_dados') || '{}');
                salvo.nome_salao = data.nome_salao;
                salvo.logo_url = data.logo_url || '';
                localStorage.setItem('hairconcept_prof_dados', JSON.stringify(salvo));
            }
        } catch (e) {
            console.warn('Erro ao carregar a identidade do salão:', e);
        }
    },

    // ===== Estados do atendimento =====
    normalizarHora(v) { return String(v || '').slice(0, 5); },

    // Fim real de um atendimento (se nao tiver, assume 30 minutos)
    fimDoAtendimento(ag) {
        const inicio = this.minutosDoDia(this.normalizarHora(ag.horario));
        const temFim = !!(ag.horario_fim && this.normalizarHora(ag.horario_fim));
        const fim = temFim ? this.minutosDoDia(this.normalizarHora(ag.horario_fim)) : (inicio + 30);
        return fim > inicio ? fim : inicio + 30;
    },

    // Um horario esta ocupado se cai dentro de algum atendimento do profissional
    horarioOcupado(agendamentos, profId, hhmm) {
        const alvo = this.minutosDoDia(hhmm);
        if (alvo < 0) return false;
        return (agendamentos || []).some(a => {
            if (String(a.profissional_id) !== String(profId)) return false;
            const inicio = this.minutosDoDia(this.normalizarHora(a.horario));
            const fim = this.fimDoAtendimento(a);
            return inicio >= 0 && alvo >= inicio && alvo < fim;
        });
    },

    // Devolve a lista de horarios livres do profissional naquele dia
    horariosLivres(agendamentos, profId) {
        const todos = [];
        for (let m = 480; m <= 1080; m += 30) {
            todos.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
        }
        if (!profId) return todos;
        return todos.filter(h => !this.horarioOcupado(agendamentos, profId, h));
    },

    // Aplica o bloqueio nos campos de hora da janela de marcar
    async aplicarHorariosLivres() {
        const selProf = document.getElementById('agendamento-profissional');
        const campoHora = document.getElementById('agendamento-horario');
        const campoFim = document.getElementById('agendamento-horario-fim');
        const campoData = document.getElementById('agendamento-data');
        if (!selProf || !campoHora) return;

        // Modo encaixe: nao bloqueia nada (a decisao e do salao)
        if (this._modoEncaixe) {
            campoHora.removeAttribute('disabled');
            if (campoFim) campoFim.removeAttribute('disabled');
            return;
        }

        const estabId = await this.obterEstabId();
        const dataEscolhida = campoData ? campoData.value : null;
        if (!estabId || !dataEscolhida) return;

        try {
            const { data, error } = await supabaseClient
                .from('agendamentos')
                .select('horario, horario_fim, profissional_id')
                .eq('estabelecimento_id', estabId)
                .eq('data', dataEscolhida);
            if (error) { console.warn('Nao foi possivel conferir a agenda:', error.message); return; }

            const profId = selProf.value;
            const livres = this.horariosLivres(data || [], profId);

            if (livres.length === 0) {
                UI.showToast('Esse profissional nao tem horario livre neste dia. Use "Adicionar dentro" num atendimento.', 'error');
                return;
            }

            // Se a hora atual esta ocupada, pula para o primeiro horario livre
            const atual = this.normalizarHora(campoHora.value);
            if (livres.indexOf(atual) < 0) {
                campoHora.value = livres[0];
                if (campoFim) {
                    const mi = this.minutosDoDia(livres[0]);
                    const mf = mi + 30;
                    campoFim.value = String(Math.floor(mf / 60)).padStart(2, '0') + ':' + String(mf % 60).padStart(2, '0');
                }
            }
        } catch (e) {
            console.warn('Erro ao aplicar horarios livres:', e);
        }
    },

    minutosDoDia(hhmm) {
        const p = String(hhmm || '').split(':');
        const h = parseInt(p[0], 10);
        const m = parseInt(p[1], 10);
        if (isNaN(h) || isNaN(m)) return -1;
        return (h * 60) + m;
    },

    // O atendimento cobre todos os blocos entre o inicio e o fim
    cobreHorario(ag, hhmm) {
        const inicio = this.minutosDoDia(this.normalizarHora(ag.horario));
        const temFim = !!(ag.horario_fim && this.normalizarHora(ag.horario_fim));
        const fim = temFim ? this.minutosDoDia(this.normalizarHora(ag.horario_fim)) : (inicio + 30);
        const alvo = this.minutosDoDia(hhmm);
        if (inicio < 0 || alvo < 0) return false;
        return alvo >= inicio && alvo < fim;
    },

    duracaoMinutos(ag) {
        const inicio = this.minutosDoDia(this.normalizarHora(ag.horario));
        const temFim = !!(ag.horario_fim && this.normalizarHora(ag.horario_fim));
        if (inicio < 0) return 30;
        if (!temFim) return 30;
        const fim = this.minutosDoDia(this.normalizarHora(ag.horario_fim));
        const d = fim - inicio;
        return d > 0 ? d : 30;
    },

    classeEstado(status) {
        const s = String(status || 'espera').toLowerCase();
        if (s === 'atendendo') return 'ag-atendendo';
        if (s === 'finalizado') return 'ag-finalizado';
        if (s === 'faltou') return 'ag-faltou';
        return 'ag-espera';
    },

    rotuloEstado(status) {
        const s = String(status || 'espera').toLowerCase();
        if (s === 'atendendo') return 'Atendendo';
        if (s === 'finalizado') return 'Finalizado';
        if (s === 'faltou') return 'Nao veio';
        return 'Em espera';
    },

    aplicarIdentidadeNoHeader(nomeSalao, logoUrl) {
        const elNome = document.getElementById('saloon-name-header');
        const assinatura = document.getElementById('header-assinatura');
        const temNome = !!(nomeSalao && nomeSalao.trim()) && nomeSalao.trim().toLowerCase() !== 'meu salão';

        // Nome: o do salão, ou um neutro até ele cadastrar
        if (elNome) elNome.textContent = temNome ? nomeSalao.trim() : 'Bem-vindo';
        // A assinatura HairConcept some quando o salão tem nome próprio
        if (assinatura) assinatura.classList.toggle('hidden', temNome);

        this.aplicarLogoNoHeader(logoUrl);
    },

    aplicarLogoNoHeader(logoUrl) {
        const img = document.getElementById('header-logo-img');
        const icone = document.getElementById('header-icon-scissors');
        if (!img || !icone) return;
        if (logoUrl) {
            img.src = logoUrl;
            img.classList.remove('hidden');
            icone.classList.add('hidden');
        } else {
            img.src = '';
            img.classList.add('hidden');
            icone.classList.remove('hidden');
        }
    },

    montarEmailInterno(cpf, idSalao) {
        // E-mail invisível: o profissional continua entrando só com CPF e senha.
        const cpfLimpo = String(cpf || '').replace(/\D/g, '');
        const salaoCurto = String(idSalao || '').replace(/-/g, '').slice(0, 8);
        if (!cpfLimpo || !salaoCurto) return null;
        return `prof.${cpfLimpo}.${salaoCurto}@hairconcept.com.br`;
    },

    async obterEstabId() {
        // Devolve o ID do salao VALIDANDO contra o banco. Se o valor guardado estiver
        // velho (de outro salao ou de um teste), busca o correto e regenera.
        let id = localStorage.getItem('hairconcept_estab_id');
        if (!supabaseClient || !supabaseClient.auth) return id || null;
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return id || null;
            if (id) {
                const { data: confere } = await supabaseClient
                    .from('estabelecimentos')
                    .select('id')
                    .eq('id', id)
                    .eq('user_id', session.user.id)
                    .maybeSingle();
                if (confere && confere.id) return id;
            }
            const { data: estab } = await supabaseClient
                .from('estabelecimentos')
                .select('id')
                .eq('user_id', session.user.id)
                .limit(1)
                .maybeSingle();
            if (estab && estab.id) {
                localStorage.setItem('hairconcept_estab_id', estab.id);
                return estab.id;
            }
        } catch (e) {
            console.warn('Erro ao validar o salao:', e);
        }
        return id || null;
    },
,

    // Abre a janela para colocar um serviço DENTRO de um atendimento
    abrirEncaixe(pai) {
        if (!pai) return;
        this._modoEncaixe = true;
        const campoData = document.getElementById('agendamento-data');
        if (campoData) campoData.value = document.getElementById('filtro-data-agenda')?.value || dataLocalISO();

        // Sugere: começa no início do atendimento e dura 30 minutos
        const inicio = this.normalizarHora(pai.horario) || '08:00';
        const mi = this.minutosDoDia(inicio);
        const mf = mi + 30;
        const fim = mi >= 0
            ? String(Math.floor(mf / 60)).padStart(2, '0') + ':' + String(mf % 60).padStart(2, '0')
            : '08:30';

        const campoHora = document.getElementById('agendamento-horario');
        const campoFim = document.getElementById('agendamento-horario-fim');
        if (campoHora) campoHora.value = inicio;
        if (campoFim) campoFim.value = fim;

        const selProf = document.getElementById('agendamento-profissional');
        if (selProf && pai.profissional_id) selProf.value = pai.profissional_id;

        const cx = document.getElementById('agendamento-encaixe');
        if (cx) cx.checked = false;

        const aviso = document.getElementById('aviso-encaixe');
        if (aviso) aviso.classList.remove('hidden');
        Auth.abrirModal('modal-marcar');
        UI.showToast('Preenchendo dentro do atendimento de ' + (pai.cliente || '') + '.');
    },

    // ===== FECHAMENTO DO PROFISSIONAL =====
    hojeISO() { return dataLocalISO(); },

    // Carrega o ciclo atual e o historico de fechamentos
    async carregarFechamento() {
        const painel = document.getElementById('painel-fechamento');
        if (!painel) return;
        const lista = document.getElementById('fech-lista');
        const hist = document.getElementById('fech-historico');
        const elPeriodo = document.getElementById('fech-periodo');
        const elQtd = document.getElementById('fech-qtd');
        const elValor = document.getElementById('fech-valor');

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return;

            // Descobre o id do profissional desta sessao
            let profId = this.user.id;
            if (!profId) {
                const { data: p } = await supabaseClient
                    .from('profissionais').select('id').eq('user_id', session.user.id).maybeSingle();
                if (p) profId = p.id;
            }
            if (!profId) return;
            this._profIdFech = profId;

            // Inicio do ciclo: dia seguinte ao ultimo fechamento
            const { data: fechs } = await supabaseClient
                .from('fechamentos').select('*')
                .eq('profissional_id', profId)
                .order('fim', { ascending: false });

            let inicio = '0001-01-01';
            if (fechs && fechs.length > 0 && fechs[0].fim) {
                const d = new Date(fechs[0].fim + 'T00:00:00');
                d.setDate(d.getDate() + 1);
                inicio = dataLocalISO(d);
            }
            this._inicioCiclo = inicio;

            // Atendimentos do ciclo (do inicio ate hoje)
            const hoje = dataLocalISO();
            const { data: ags, error } = await supabaseClient
                .from('agendamentos').select('*')
                .eq('profissional_id', profId)
                .gte('data', inicio)
                .lte('data', hoje)
                .order('data', { ascending: true });
            if (error) { console.warn('Erro ao buscar atendimentos do ciclo:', error.message); }

            const atendimentos = (ags || []).filter(function (a) {
                return String(a.status || '').toLowerCase() !== 'faltou';
            });
            const totalValor = atendimentos.reduce(function (s, a) { return s + (parseFloat(a.valor) || 0); }, 0);

            this._totalCiclo = { qtd: atendimentos.length, valor: totalValor };

            if (elPeriodo) {
                const de = inicio === '0001-01-01' ? 'o comeco' : inicio.split('-').reverse().join('/');
                elPeriodo.textContent = 'Ciclo atual: de ' + de + ' ate hoje (' + hoje.split('-').reverse().join('/') + ')';
            }
            if (elQtd) elQtd.textContent = String(atendimentos.length);
            if (elValor) elValor.textContent = 'R$ ' + totalValor.toFixed(2);
            this.calcularFechamento();

            // Lista dos atendimentos do ciclo
            if (lista) {
                lista.innerHTML = '';
                if (atendimentos.length === 0) {
                    const p = document.createElement('p');
                    p.className = 'text-xs text-zinc-500';
                    p.textContent = 'Nenhum atendimento neste ciclo ainda.';
                    lista.appendChild(p);
                }
                atendimentos.slice().reverse().forEach(function (a) {
                    const linha = document.createElement('div');
                    linha.className = 'fech-linha';
                    const esq = document.createElement('div');
                    const dia = document.createElement('span');
                    dia.className = 'dia';
                    dia.textContent = (a.data || '').split('-').reverse().slice(0, 2).join('/') + ' ' + this.normalizarHora(a.horario);
                    const cli = document.createElement('span');
                    cli.className = 'cli ml-2';
                    cli.textContent = a.cliente || '';
                    const sv = document.createElement('span');
                    sv.className = 'text-zinc-400 ml-2';
                    sv.textContent = a.servico || '';
                    esq.appendChild(dia); esq.appendChild(cli); esq.appendChild(sv);
                    const val = document.createElement('span');
                    val.className = 'val';
                    val.textContent = 'R$ ' + (parseFloat(a.valor) || 0).toFixed(2);
                    linha.appendChild(esq); linha.appendChild(val);
                    lista.appendChild(linha);
                }.bind(this));
            }

            // Historico de ciclos fechados
            if (hist) {
                hist.innerHTML = '';
                if (!fechs || fechs.length === 0) {
                    const p = document.createElement('p');
                    p.className = 'text-xs text-zinc-500';
                    p.textContent = 'Nenhum ciclo fechado ainda.';
                    hist.appendChild(p);
                }
                (fechs || []).forEach(function (f) {
                    const linha = document.createElement('div');
                    linha.className = 'fech-linha';
                    const esq = document.createElement('div');
                    const per = document.createElement('span');
                    per.className = 'dia';
                    per.textContent = (f.inicio || '').split('-').reverse().join('/') + ' a ' + (f.fim || '').split('-').reverse().join('/');
                    const rec = document.createElement('span');
                    rec.className = 'text-zinc-400 ml-2';
                    rec.textContent = f.recebido_em ? 'recebido em ' + f.recebido_em.split('-').reverse().join('/') : '';
                    esq.appendChild(per); esq.appendChild(rec);
                    const val = document.createElement('span');
                    val.className = 'val';
                    val.textContent = 'R$ ' + (parseFloat(f.total_comissao) || 0).toFixed(2) + ' de comissao';
                    linha.appendChild(esq); linha.appendChild(val);
                    hist.appendChild(linha);
                });
            }
        } catch (e) {
            console.warn('Erro ao carregar o fechamento:', e);
        }
    },

    calcularFechamento() {
        const pct = parseFloat(document.getElementById('fech-pct')?.value);
        const total = this._totalCiclo ? this._totalCiclo.valor : 0;
        const com = isNaN(pct) ? 0 : (total * pct) / 100;
        const el = document.getElementById('fech-comissao');
        if (el) el.textContent = 'R$ ' + com.toFixed(2);
    },

    abrirFecharCiclo() {
        const total = this._totalCiclo || { qtd: 0, valor: 0 };
        const pct = parseFloat(document.getElementById('fech-pct')?.value);
        const com = isNaN(pct) ? 0 : (total.valor * pct) / 100;

        const elPer = document.getElementById('fechar-periodo');
        const elQtd = document.getElementById('fechar-atend');
        const elVal = document.getElementById('fechar-valor');
        const elCom = document.getElementById('fechar-comissao');
        const elData = document.getElementById('fechar-recebido');

        const inicio = this._inicioCiclo && this._inicioCiclo !== '0001-01-01' ? this._inicioCiclo : null;
        if (elPer) elPer.textContent = 'Periodo: ' + (inicio ? inicio.split('-').reverse().join('/') : 'inicio') + ' ate ' + dataLocalISO().split('-').reverse().join('/');
        if (elQtd) elQtd.textContent = String(total.qtd);
        if (elVal) elVal.textContent = 'R$ ' + total.valor.toFixed(2);
        if (elCom) elCom.textContent = 'R$ ' + com.toFixed(2);
        if (elData) elData.value = dataLocalISO();
        Auth.abrirModal('modal-fechar');
    },

    async confirmarFechamento() {
        const profId = this._profIdFech;
        const total = this._totalCiclo || { qtd: 0, valor: 0 };
        if (!profId) { UI.showToast('Nao encontrei o seu cadastro. Recarregue a pagina.', 'error'); return; }
        if (total.qtd === 0) { UI.showToast('Nao ha atendimentos neste ciclo para fechar.', 'error'); return; }

        const pct = parseFloat(document.getElementById('fech-pct')?.value);
        const comissaoPct = isNaN(pct) ? 0 : pct;
        const comissaoVal = (total.valor * comissaoPct) / 100;
        const recebido = document.getElementById('fechar-recebido')?.value || dataLocalISO();

        try {
            const { error } = await supabaseClient.from('fechamentos').insert([{
                estabelecimento_id: localStorage.getItem('hairconcept_estab_id'),
                profissional_id: profId,
                inicio: this._inicioCiclo && this._inicioCiclo !== '0001-01-01' ? this._inicioCiclo : dataLocalISO(),
                fim: dataLocalISO(),
                total_atendimentos: total.qtd,
                total_valor: total.valor,
                comissao_pct: comissaoPct,
                total_comissao: comissaoVal,
                recebido_em: recebido
            }]);
            if (error) {
                console.error('Erro ao fechar o ciclo:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            Auth.fecharModal('modal-fechar');
            const campoPct = document.getElementById('fech-pct');
            if (campoPct) campoPct.value = '';
            UI.showToast('Ciclo fechado! O proximo comeca amanha.');
            this.carregarFechamento();
        } catch (e) {
            console.error('Erro inesperado ao fechar:', e);
            UI.showToast('Erro inesperado ao fechar o ciclo.', 'error');
        }
    },

    abrirMarcar(horario) {
        this._modoEncaixe = false;
        const campoData = document.getElementById('agendamento-data');
        const campoHora = document.getElementById('agendamento-horario');
        if (campoData) campoData.value = document.getElementById('filtro-data-agenda')?.value || dataLocalISO();
        if (campoHora) campoHora.value = horario || '08:00';
        const campoFim = document.getElementById('agendamento-horario-fim');
        if (campoFim) {
            const m = this.minutosDoDia(campoHora ? campoHora.value : '08:00');
            const fim = m >= 0 ? m + 30 : 510;
            const hh = String(Math.floor(fim / 60)).padStart(2, '0');
            const mm = String(fim % 60).padStart(2, '0');
            campoFim.value = hh + ':' + mm;
        }
        const cxEncaixe = document.getElementById('agendamento-encaixe');
        if (cxEncaixe) cxEncaixe.checked = false;
        const avisoEnc = document.getElementById('aviso-encaixe');
        if (avisoEnc) avisoEnc.classList.add('hidden');
        this.aplicarHorariosLivres();
        Auth.abrirModal('modal-marcar');
    },

    async handleCreateAgendamento(event) {
        event.preventDefault();
        const estabId = await this.obterEstabId();
        if (!estabId) {
            UI.showToast('Não encontrei o seu salão. Recarregue a página e entre novamente.', 'error');
            return;
        }
        const data = document.getElementById('agendamento-data').value;
        const profissional_id = document.getElementById('agendamento-profissional').value;
        // Envia só HH:MM para o banco, sem os segundos
        const horario = String(document.getElementById('agendamento-horario')?.value || '').slice(0, 5);
        const horarioFim = String(document.getElementById('agendamento-horario-fim')?.value || '').slice(0, 5);
        const aceitaEncaixe = !!document.getElementById('agendamento-encaixe')?.checked;

        if (!horarioFim || horarioFim <= horario) {
            UI.showToast('O horário de fim precisa ser depois do horário de início.', 'error');
            return;
        }

        // Fora do modo encaixe, nao deixa marcar em cima de outro atendimento
        if (!this._modoEncaixe) {
            try {
                const { data: doDia } = await supabaseClient
                    .from('agendamentos')
                    .select('horario, horario_fim, profissional_id, cliente')
                    .eq('estabelecimento_id', estabId)
                    .eq('data', data)
                    .eq('profissional_id', profissional_id);
                if (this.horarioOcupado(doDia || [], profissional_id, horario)) {
                    UI.showToast('Esse horario ja esta ocupado para ' + (nomeProfissional || 'este profissional') + '. Use "Adicionar dentro" se quiser encaixar.', 'error');
                    return;
                }
            } catch (e) {
                console.warn('Nao foi possivel conferir a agenda:', e);
            }
        }
        const cliente = document.getElementById('cliente-nome').value;
        const servico = document.getElementById('cliente-servico').value;
        const valor = parseValor(document.getElementById('cliente-valor').value);
        try {
            const { error } = await supabaseClient.from('agendamentos').insert([{
                estabelecimento_id: estabId,
                data,
                profissional_id,
                horario: horario,
                horario_fim: horarioFim,
                status: 'espera',
                aceita_encaixe: aceitaEncaixe,
                cliente,
                servico,
                valor
            }]);
            if (error) throw error;
            UI.showToast('Agendamento efetuado com sucesso!');
            document.getElementById('cliente-nome').value = '';
            document.getElementById('cliente-servico').value = '';
            document.getElementById('cliente-valor').value = '';
            Auth.fecharModal('modal-marcar');
            this.renderAgendaGrid();
            this.renderRelatorios();
        } catch (e) {
            UI.showToast('Nao consegui marcar o atendimento. ' + mensagemAmigavel(e), 'error');
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
            // Pontos de elogio e total de clientes, para as estrelas do cabeçalho
            let votosProf = {};
            let totalClientesBase = 0;
            try {
                const { data: vv } = await supabaseClient
                    .from('avaliacoes_cliente').select('profissional_id, tipo')
                    .eq('estabelecimento_id', estabId);
                (vv || []).forEach(function (v) {
                    if (!v.profissional_id || v.tipo !== 'mais') return;
                    votosProf[v.profissional_id] = (votosProf[v.profissional_id] || 0) + 1;
                });
                const { count } = await supabaseClient
                    .from('clientes').select('*', { count: 'exact', head: true })
                    .eq('estabelecimento_id', estabId);
                totalClientesBase = count || 0;
            } catch (e) {
                console.warn('Nao foi possivel carregar as estrelas:', e);
            }
            if (!profs || profs.length === 0) {
                headerRow.innerHTML = '<th class="py-3 px-4">Horário</th><th class="py-3 px-4">Sem profissionais cadastrados</th>';
                tbody.innerHTML = '<tr><td colspan="2" class="py-4 px-4 text-center text-zinc-500">Cadastre profissionais na aba Equipe para ver a agenda.</td></tr>';
                return;
            }
            let profsExibicao = profs;
            if (this.user.role === 'profissional') {
                profsExibicao = profs.filter(p => p.id == this.user.id);
            }
            headerRow.innerHTML = '';
            const thHora = document.createElement('th');
            thHora.className = 'py-3 px-4 w-24';
            thHora.textContent = 'Horário';
            headerRow.appendChild(thHora);

            profsExibicao.forEach(function (p) {
                const th = document.createElement('th');
                th.className = 'py-3 px-4';
                const linha = document.createElement('div');
                linha.className = 'flex items-center gap-2';

                const img = document.createElement('img');
                img.src = p.foto_url || FOTO_PADRAO;
                img.className = 'w-7 h-7 rounded-lg object-cover';

                const bloco = document.createElement('div');
                const nomeEl = document.createElement('span');
                nomeEl.className = 'block text-white font-bold';
                nomeEl.textContent = p.nome || '';
                const cargoEl = document.createElement('span');
                cargoEl.className = 'block text-[9px] text-zinc-400';
                cargoEl.textContent = p.cargo || '';

                const meusPontos = (votosProf || {})[p.id] || 0;
                const estP = App.calcularEstrelaProf(meusPontos, totalClientesBase);
                const linhaEst = document.createElement('span');
                linhaEst.className = 'prof-estrelas mt-0.5';
                for (let i = 0; i < estP.cheias; i++) linhaEst.innerHTML += '<i class="fa-solid fa-star"></i>';
                if (estP.meia) linhaEst.innerHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
                for (let i = 0; i < estP.vazias; i++) linhaEst.innerHTML += '<i class="fa-regular fa-star text-zinc-600"></i>';
                const contEst = document.createElement('span');
                contEst.className = 'text-[8px] text-zinc-500 ml-1';
                contEst.textContent = meusPontos + '/' + totalClientesBase;
                linhaEst.appendChild(contEst);

                bloco.appendChild(nomeEl);
                bloco.appendChild(cargoEl);
                bloco.appendChild(linhaEst);
                linha.appendChild(img);
                linha.appendChild(bloco);
                th.appendChild(linha);
                headerRow.appendChild(th);
            });

            const horarios = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"];
            let atendimentoCount = 0;
            let totalGanhos = 0;

            tbody.innerHTML = '';
            horarios.forEach(h => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-white/5';

                const tdHora = document.createElement('td');
                tdHora.className = 'py-3 px-4 text-brand-500 font-bold';
                tdHora.textContent = h;
                tr.appendChild(tdHora);

                profsExibicao.forEach(p => {
                    // O banco guarda 14:00:00 e a grade usa 14:00: compara só HH:MM
                    const hhmm = (v) => String(v || '').slice(0, 5);
                    // 1) o atendimento que COMECA neste bloco
                    const ag = (agendamentos || []).find(a => a.profissional_id == p.id && hhmm(a.horario) === hhmm(h));
                    // 2) o atendimento que COBRE este bloco (servico longo em andamento)
                    const agCobrindo = !ag ? (agendamentos || []).find(a => a.profissional_id == p.id && this.cobreHorario(a, hhmm(h))) : null;
                    const agExibir = ag || agCobrindo;
                    if (ag && this.user.role === 'profissional') {
                        atendimentoCount++;
                        totalGanhos += (ag.valor * 0.5);
                    }

                    const td = document.createElement('td');
                    td.className = 'py-3 px-4';

                    if (agExibir) {
                        const ag = agExibir;
                        const ehInicio = this.normalizarHora(ag.horario) === this.normalizarHora(h);
                        if (!ag.status) ag.status = 'espera';

                        if (!ehInicio) {
                            // Bloco de continuacao: faixa colorida, sem texto repetido
                            const cont = document.createElement('div');
                            const est = String(ag.status || 'espera').toLowerCase();
                            const estOk = ['espera','atendendo','finalizado','faltou'].indexOf(est) >= 0 ? est : 'espera';
                            cont.className = 'ag-continuacao ag-cont-' + estOk;
                            cont.title = ag.cliente + ' • ' + this.rotuloEstado(ag.status);

                            // Se um encaixe COMECA neste bloco, ele aparece aqui em verde
                            const encaixesAqui = (agendamentos || []).filter(x => {
                                if (x.id === ag.id || x.profissional_id != p.id) return false;
                                if (this.normalizarHora(x.horario) !== this.normalizarHora(h)) return false;
                                if (!this.cobreHorario(ag, this.normalizarHora(x.horario))) return false;
                                return this.duracaoMinutos(x) < this.duracaoMinutos(ag);
                            });
                            encaixesAqui.forEach(x => {
                                const e = document.createElement('span');
                                e.className = 'ag-encaixe';
                                e.textContent = 'Encaixe ' + this.normalizarHora(x.horario) + ' - ' + this.normalizarHora(x.horario_fim) + ' - ' + x.cliente;
                                cont.appendChild(e);
                            });

                            td.appendChild(cont);
                        } else {
                        const caixa = document.createElement('div');
                        caixa.className = 'ag-atendimento ' + this.classeEstado(ag.status);

                        const cor = document.createElement('span');
                        cor.className = 'ag-cor ag-cor-' + (String(ag.status || 'espera').toLowerCase());
                        const nome = document.createElement('strong');
                        nome.className = 'text-white block';
                        nome.textContent = ag.cliente;
                        nome.prepend(cor);

                        const serv = document.createElement('span');
                        serv.className = 'block opacity-90';
                        serv.textContent = ag.servico;

                        const faixa = document.createElement('span');
                        faixa.className = 'block text-[9px] opacity-80';
                        const mi = this.minutosDoDia(this.normalizarHora(ag.horario));
                        const mf = mi + this.duracaoMinutos(ag);
                        const fimMostrar = (mi >= 0)
                            ? String(Math.floor(mf / 60)).padStart(2, '0') + ':' + String(mf % 60).padStart(2, '0')
                            : '';
                        faixa.textContent = this.normalizarHora(ag.horario) + ' - ' + fimMostrar + ' • ' + this.rotuloEstado(ag.status);

                        const val = document.createElement('span');
                        val.className = 'block font-bold mt-0.5';
                        val.textContent = 'R$ ' + parseFloat(ag.valor).toFixed(2);

                        caixa.appendChild(nome);
                        caixa.appendChild(serv);
                        caixa.appendChild(faixa);
                        caixa.appendChild(val);

                        // Encaixes dentro deste atendimento
                        // Encaixes que COMECAM neste bloco exato (nao no bloco inicial do pai)
                        const encaixes = (agendamentos || []).filter(x => {
                            if (x.id === ag.id || x.profissional_id != p.id) return false;
                            if (this.normalizarHora(x.horario) !== this.normalizarHora(h)) return false;
                            if (!this.cobreHorario(ag, this.normalizarHora(x.horario))) return false;
                            // So entra como encaixe se for um atendimento curto dentro do longo
                            return this.duracaoMinutos(x) < this.duracaoMinutos(ag);
                        });
                        if (encaixes.length > 0) {
                            encaixes.forEach(x => {
                                const e = document.createElement('span');
                                e.className = 'ag-encaixe';
                                e.textContent = 'Encaixe ' + this.normalizarHora(x.horario) + ' - ' + this.normalizarHora(x.horario_fim) + ' - ' + x.cliente;
                                caixa.appendChild(e);
                            });
                        }

                        if (this.user.role === 'admin') {
                            const acoes = document.createElement('div');
                            acoes.className = 'flex flex-wrap gap-1 mt-1.5';
                            ['espera','atendendo','finalizado','faltou'].forEach(st => {
                                const b = document.createElement('button');
                                b.className = 'text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-white/20 hover:bg-white/10 transition cursor-pointer';
                                b.textContent = this.rotuloEstado(st);
                                b.onclick = () => this.mudarStatusAgendamento(ag.id, st);
                                acoes.appendChild(b);
                            });

                            // Serviço dentro deste atendimento (encaixe)
                            const bDentro = document.createElement('button');
                            bDentro.className = 'text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer';
                            bDentro.textContent = 'Adicionar dentro';
                            bDentro.onclick = () => this.abrirEncaixe(ag);
                            acoes.appendChild(bDentro);

                            const bExcluir = document.createElement('button');
                            bExcluir.className = 'text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 transition cursor-pointer';
                            bExcluir.textContent = 'Desmarcar';
                            bExcluir.onclick = () => this.excluirAgendamento(ag.id, ag.cliente);
                            acoes.appendChild(bExcluir);

                            caixa.appendChild(acoes);
                        }

                        td.appendChild(caixa);
                        }
                    } else if (this.user.role === 'admin') {
                        const btnLivre = document.createElement('button');
                        btnLivre.className = 'text-zinc-600 hover:text-brand-500 text-[11px] transition cursor-pointer';
                        btnLivre.textContent = 'Disponível';
                        btnLivre.onclick = () => this.abrirMarcar(h);
                        td.appendChild(btnLivre);
                    } else {
                        const span = document.createElement('span');
                        span.className = 'text-zinc-600 text-[11px]';
                        span.textContent = 'Disponível';
                        td.appendChild(span);
                    }

                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });

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
        const estabId = await this.obterEstabId();
        if (!estabId) {
            UI.showToast('Não encontrei o seu salão. Recarregue a página e entre novamente.', 'error');
            return;
        }
        const nome = document.getElementById('prod-nome').value;
        const tipo = document.getElementById('prod-tipo').value;
        const preco_venda = parseValor(document.getElementById('prod-preco').value);
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
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },
    async handleCreateServico(event) {
        event.preventDefault();
        const estabId = await this.obterEstabId();
        if (!estabId) {
            UI.showToast('Não encontrei o seu salão. Recarregue a página e entre novamente.', 'error');
            return;
        }
        const nome = document.getElementById('serv-nome').value;
        const preco = parseValor(document.getElementById('serv-preco').value);
        const comissao = parseFloat(document.getElementById('serv-comissao').value) || 50;
        try {
            const { error } = await supabaseClient.from('servicos').insert([{
                estabelecimento_id: estabId,
                nome,
                preco,
                comissao
            }]);
            if (error) throw error;
            UI.showToast('Serviço adicionado com sucesso!');
            event.target.reset();
            this.renderServicos();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },
    async renderServicos() {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const lista = document.getElementById('lista-servicos');
        if (!lista) return;
        try {
            const { data, error } = await supabaseClient.from('servicos').select('*').eq('estabelecimento_id', estabId);
            if (error) throw error;
            lista.innerHTML = data && data.length > 0 ? data.map(s => `
                <div class="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex justify-between items-center">
                    <div>
                        <h4 class="text-xs font-bold text-white uppercase">${s.nome}</h4>
                        <p class="text-[10px] text-zinc-400 mt-0.5">Comissão: ${s.comissao}%</p>
                    </div>
                    <div class="text-right flex items-center gap-3">
                        <span class="text-xs font-bold text-brand-500">R$ ${parseFloat(s.preco).toFixed(2)}</span>
                        <button onclick="App.excluirServico('${s.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[10px] font-bold uppercase transition">Excluir</button>
                    </div>
                </div>
            `).join('') : '<p class="text-xs text-zinc-500 md:col-span-2">Nenhum serviço cadastrado.</p>';
        } catch (e) {
            console.error(e);
        }
    },
    async excluirServico(id) {
        if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
        try {
            const { error } = await supabaseClient.from('servicos').delete().eq('id', id);
            if (error) throw error;
            UI.showToast('Serviço excluído com sucesso!');
            this.renderServicos();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },
    async renderListaProfissionais() {
        const lista = document.getElementById('lista-profissionais');
        if (!lista) return;
        try {
            const estabId = await this.obterEstabId();
            const { data, error } = await supabaseClient.from('profissionais').select('*').eq('estabelecimento_id', estabId);
            if (error) {
                console.error('Erro ao buscar profissionais:', error);
                lista.textContent = 'Não foi possível carregar a equipe agora.';
                return;
            }

            lista.innerHTML = '';
            if (!data || data.length === 0) {
                const p = document.createElement('p');
                p.className = 'text-xs text-zinc-500';
                p.textContent = 'Nenhum profissional cadastrado.';
                lista.appendChild(p);
                return;
            }

            data.forEach(p => {
                const card = document.createElement('div');
                card.className = 'p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3 flex-wrap';

                const esquerda = document.createElement('div');
                esquerda.className = 'flex items-center gap-3';

                const img = document.createElement('img');
                img.src = p.foto_url || FOTO_PADRAO;
                img.className = 'w-10 h-10 rounded-xl object-cover';

                const info = document.createElement('div');
                const h4 = document.createElement('h4');
                h4.className = 'text-xs font-bold text-white';
                h4.textContent = p.nome || '';
                const pcargo = document.createElement('p');
                pcargo.className = 'text-[10px] text-brand-500';
                pcargo.textContent = p.cargo || '';
                const pcpf = document.createElement('p');
                pcpf.className = 'text-[9px] text-zinc-500';
                pcpf.textContent = 'CPF: ' + (p.cpf || '');
                info.appendChild(h4); info.appendChild(pcargo); info.appendChild(pcpf);
                esquerda.appendChild(img); esquerda.appendChild(info);

                const acoes = document.createElement('div');
                acoes.className = 'flex items-center gap-2 flex-wrap';

                const btnSenha = document.createElement('button');
                btnSenha.className = 'px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-500 hover:bg-brand-500/20 text-xs font-bold uppercase transition cursor-pointer';
                btnSenha.textContent = 'Trocar senha';
                btnSenha.onclick = () => this.abrirTrocarSenhaProfissional(p.id, p.nome || '', p.cpf || '');

                const btnEditar = document.createElement('button');
                btnEditar.className = 'px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-300 hover:bg-zinc-800 text-xs font-bold uppercase transition cursor-pointer';
                btnEditar.textContent = 'Editar';
                btnEditar.onclick = () => this.abrirEditarProfissional(p.id, p.nome, p.cargo, p.cpf);

                const btnExcluir = document.createElement('button');
                btnExcluir.className = 'px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold uppercase transition cursor-pointer';
                btnExcluir.textContent = 'Excluir';
                btnExcluir.onclick = () => this.excluirProfissional(p.id);

                acoes.appendChild(btnSenha);
                acoes.appendChild(btnEditar);
                acoes.appendChild(btnExcluir);

                card.appendChild(esquerda);
                card.appendChild(acoes);
                lista.appendChild(card);
            });
        } catch (e) {
            console.error('Erro inesperado ao listar profissionais:', e);
            lista.textContent = 'Não foi possível carregar a equipe agora.';
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
            lista.innerHTML = data && data.length > 0 ? data.map(prod => {
                const dataVal = new Date(prod.data_validade);
                const pertoVencer = dataVal <= daqui3Meses && dataVal >= hoje;
                if (pertoVencer) alertaCount++;
                return `
                    <div class="p-3.5 rounded-2xl bg-zinc-950 border ${pertoVencer ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10'} flex justify-between items-center">
                        <div>
                            <h4 class="text-xs font-bold text-white">${prod.nome} ${pertoVencer ? '<span class="text-[9px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full ml-2">Validade Próxima (&lt; 3 meses)</span>' : ''}</h4>
                            <p class="text-[10px] text-zinc-400">Estoque: ${prod.stock} | Validade: ${prod.data_validade} | Tipo: ${prod.tipo}</p>
                        </div>
                        <span class="text-xs font-bold text-brand-500">R$ ${parseFloat(prod.preco_venda).toFixed(2)}</span>
                    </div>
                `;
            }).join('') : '<p class="text-xs text-zinc-500">Nenhum produto cadastrado.</p>';
            if (alertaBadge) {
                alertaBadge.textContent = alertaCount > 0 ? `${alertaCount} alerta(s) de validade` : 'Estoque Regular';
            }
        } catch (e) {
            console.error(e);
        }
    },
    async renderRelatorios() {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        if (!estabId || !supabaseClient) return;
        try {
            const { data: agendamentos, error } = await supabaseClient
                .from('agendamentos')
                .select('*')
                .eq('estabelecimento_id', estabId);
            if (error) throw error;

            let faturamentoTotal = 0;
            const clientesSet = new Set();

            if (agendamentos) {
                agendamentos.forEach(a => {
                    faturamentoTotal += parseValor(a.valor);
                    if (a.cliente) clientesSet.add(a.cliente.trim().toLowerCase());
                });
            }

            const fatElem = document.getElementById('relatorio-faturamento');
            const atemElem = document.getElementById('relatorio-atendimentos');
            const cliElem = document.getElementById('relatorio-clientes');

            if (fatElem) fatElem.textContent = `R$ ${faturamentoTotal.toFixed(2)}`;
            if (atemElem) atemElem.textContent = agendamentos ? agendamentos.length : 0;
            if (cliElem) cliElem.textContent = clientesSet.size;
        } catch (e) {
            console.error("Erro ao carregar relatórios:", e);
        }
    },
    async renderAvaliacoes() {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const container = document.getElementById('lista-avaliacoes');
        if (!container) return;
        try {
            const { data, error } = await supabaseClient
                .from('avaliacoes')
                .select('*')
                .eq('estabelecimento_id', estabId)
                .order('created_at', { ascending: false });

            if (error || !data || data.length === 0) {
                container.innerHTML = '<p class="text-xs text-zinc-500">Nenhuma avaliação registrada até o momento.</p>';
                return;
            }

            container.innerHTML = data.map(av => `
                <div class="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-bold text-white uppercase">${av.cliente_nome || 'Cliente Anônimo'}</span>
                        <div class="flex text-yellow-400 text-xs">
                            ${'★'.repeat(av.nota || 5)}${'☆'.repeat(5 - (av.nota || 5))}
                        </div>
                    </div>
                    <p class="text-xs text-zinc-300 italic">"${av.comentario || 'Sem comentário'}"</p>
                    <span class="text-[9px] text-zinc-500 block">${new Date(av.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<p class="text-xs text-zinc-500">Nenhuma avaliação registrada até o momento.</p>';
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
        const postits = JSON.parse(localStorage.getItem('hairconcept_postits') || '["Ligar para fornecedor", "Comprar novo secador"]');
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
        const val = parseValor(document.getElementById('prof-calc-val').value);
        const porc = parseFloat(document.getElementById('prof-calc-porc').value);
        const percentual = isNaN(porc) ? 50 : porc;
        const total = (val * percentual) / 100;
        document.getElementById('prof-calc-result').textContent = `R$ ${total.toFixed(2)}`;
    },
    proximaFrase() {
        const frases = [
            "O sucesso é a soma de pequenos esforços repetidos.",
            "A beleza está nos detalhes e no carinho com o cliente.",
            "Um dia produtivo começa com um sorriso e foco."
        ];
        const aleatoria = frases[Math.floor(Math.random() * frases.length)];
        document.getElementById('frase-motivacional').textContent = `"${aleatoria}"`;
    },
    async setPlan(plano) {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        
        if (plano === 'gratis') {
            localStorage.setItem('hairconcept_plan', 'gratis');
            if (estabId && supabaseClient) {
                await supabaseClient.from('estabelecimentos').update({ plano: 'gratis' }).eq('id', estabId);
            }
            UI.showToast('Plano Grátis ativado com sucesso!');
            UI.switchTab('aba-agenda');
            return;
        }

        const linksPagamento = {
            mensal: 'https://mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=c6608384109b43c787b82d8f9646331f',
            anual: 'https://mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=SEU_PLANO_ANUAL_ID_AQUI' 
        };

        const linkCheckout = linksPagamento[plano];
        if (linkCheckout) {
            localStorage.setItem('hairconcept_plan_pendente', plano);
            UI.showToast('Redirecionando para o Mercado Pago...');
            setTimeout(() => {
                window.location.href = linkCheckout;
            }, 1000);
        } else {
            UI.showToast('Plano inválido.', 'error');
        }
    },
    mudarDia(dias) {
        const dataInput = document.getElementById('filtro-data-agenda');
        if (!dataInput.value) return;
        const atual = new Date(dataInput.value + 'T00:00:00');
        atual.setDate(atual.getDate() + dias);
        dataInput.value = dataLocalISO(atual);
        this.renderAgendaGrid();
    },
    irParaHoje() {
        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput) {
            dataInput.value = dataLocalISO();
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
    },
    async carregarConfiguracoes() {
        const estabId = localStorage.getItem('hairconcept_estab_id');
        if (!estabId || !supabaseClient) return;
        try {
            const { data, error } = await supabaseClient
                .from('estabelecimentos')
                .select('*')
                .eq('id', estabId)
                .single();
            if (error) throw error;
            if (data) {
                const inputNome = document.getElementById('config-nome-salao');
                const inputEmail = document.getElementById('config-email-salao');
                const inputCnpj = document.getElementById('config-cnpj');
                const inputWhatsapp = document.getElementById('config-whatsapp');
                const inputEndereco = document.getElementById('config-endereco');
                const inputInstagram = document.getElementById('config-instagram');
                const inputFacebook = document.getElementById('config-facebook');
                const inputAbertura = document.getElementById('config-horario-abertura');
                const inputFechamento = document.getElementById('config-horario-fechamento');

                if (inputNome) inputNome.value = data.nome_salao || '';
                if (inputEmail) inputEmail.value = data.email || '';
                if (inputCnpj && data.cnpj) inputCnpj.value = data.cnpj;
                if (inputWhatsapp && data.whatsapp) inputWhatsapp.value = data.whatsapp;
                if (inputEndereco && data.endereco) inputEndereco.value = data.endereco;
                if (inputInstagram && data.instagram) inputInstagram.value = data.instagram;
                if (inputFacebook && data.facebook) inputFacebook.value = data.facebook;
                if (inputAbertura && data.horario_abertura) inputAbertura.value = String(data.horario_abertura).slice(0, 5);
                if (inputFechamento && data.horario_fechamento) inputFechamento.value = String(data.horario_fechamento).slice(0, 5);

                if (data.logo_url) {
                    this.logoBase64Temp = data.logo_url;
                    const preview = document.getElementById('preview-logo-salao');
                    const icon = document.getElementById('icon-logo-salao');
                    if (preview) {
                        preview.src = data.logo_url;
                        preview.classList.remove('hidden');
                    }
                    if (icon) icon.classList.add('hidden');
                }
                // Nome, assinatura e logo de uma vez só
                this.aplicarIdentidadeNoHeader(data.nome_salao, data.logo_url || null);
            }
        } catch (e) {
            console.error("Erro ao carregar configurações:", e);
        }
    },
    async handleSalvarConfiguracoes(event) {
        event.preventDefault();
        const estabId = localStorage.getItem('hairconcept_estab_id');
        const nome_salao = document.getElementById('config-nome-salao').value.trim();
        const email = document.getElementById('config-email-salao').value.trim();
        const cnpj = document.getElementById('config-cnpj')?.value.trim() || '';
        const whatsapp = document.getElementById('config-whatsapp')?.value.trim() || '';
        const endereco = document.getElementById('config-endereco')?.value.trim() || '';
        const instagram = document.getElementById('config-instagram')?.value.trim() || '';
        const facebook = document.getElementById('config-facebook')?.value.trim() || '';
        // Campo de hora vazio precisa virar null: o banco recusa string vazia
        const horario_abertura = document.getElementById('config-horario-abertura')?.value || null;
        const horario_fechamento = document.getElementById('config-horario-fechamento')?.value || null;
        const logo_url = this.logoBase64Temp;

        if (!estabId || !supabaseClient) {
            UI.showToast('Erro: Estabelecimento não identificado.', 'error');
            return;
        }
        try {
            const { error } = await supabaseClient
                .from('estabelecimentos')
                .update({ 
                    nome_salao, 
                    email, 
                    cnpj, 
                    whatsapp, 
                    endereco, 
                    instagram, 
                    facebook, 
                    horario_abertura, 
                    horario_fechamento,
                    logo_url 
                })
                .eq('id', estabId);
            if (error) throw error;
            UI.showToast('Configurações salvas com sucesso!');
            // Aplica nome, assinatura e logo na hora
            this.aplicarIdentidadeNoHeader(nome_salao, logo_url || null);
        } catch (e) {
            console.error('Erro ao salvar configurações:', e);
            const msg = String(e && e.message ? e.message : e);
            if (msg.toLowerCase().indexOf('time') >= 0) {
                UI.showToast('Preencha os dois horários de funcionamento antes de salvar.', 'error');
            } else {
                UI.showToast('Erro ao salvar configurações: ' + msg, 'error');
            }
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
    trocarEspaco(qual) {
        const paineis = ['servicos', 'produtos', 'avaliacoes-nova'];
        if (paineis.indexOf(qual) < 0) return;
        paineis.forEach(function (p) {
            const painel = document.getElementById('aba-' + p);
            const botao = document.getElementById('btn-espaco-' + p);
            const ativo = (p === qual);
            if (painel) painel.classList.toggle('hidden', !ativo);
            if (botao) {
                botao.classList.toggle('bg-brand-500/15', ativo);
                botao.classList.toggle('text-brand-500', ativo);
                botao.classList.toggle('bg-zinc-900', !ativo);
                botao.classList.toggle('border', !ativo);
                botao.classList.toggle('border-white/10', !ativo);
                botao.classList.toggle('text-zinc-400', !ativo);
            }
        });
        // Recarrega a lista do painel aberto
        if (qual === 'servicos') App.renderServicos();
        if (qual === 'produtos') App.renderProdutos();
        if (qual === 'avaliacoes-nova') App.renderRankingGestao();
    },
    abrirGestao(qual) {
        this.switchTab('aba-gestao');
        this.trocarEspaco(qual || 'servicos');
    },

    switchTab(tabId) {
        const alvo = document.getElementById(tabId);
        if (!alvo) return;
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        alvo.classList.remove('hidden');
        if (tabId === 'aba-gestao') this.trocarEspaco('servicos');
        if (tabId === 'aba-clientes') App.renderClientes();
    },
    toggleMobileMenu(forceState) {
        const menu = document.getElementById('mobile-nav-menu');
        if (!menu) return;
        if (typeof forceState === 'boolean') {
            if (forceState) menu.classList.remove('hidden');
            else menu.classList.add('hidden');
        } else {
            menu.classList.toggle('hidden');
        }
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    // Profissional: restaura o login salvo no navegador
    const profSalvo = localStorage.getItem('hairconcept_prof_dados');
    if (profSalvo) {
        try {
            const data = JSON.parse(profSalvo);
            if (!data || !data.id) throw new Error('dados incompletos');
            App.user = { loggedIn: true, role: 'profissional', name: data.nome || '', id: data.id };
            App.aplicarIdentidadeNoHeader(data.nome_salao, data.logo_url || null);
            if (data.estabelecimento_id) App.carregarIdentidadeDoSalao(data.estabelecimento_id);
            const nomeEl = document.getElementById('prof-header-nome');
            const cargoEl = document.getElementById('prof-header-cargo');
            const fotoEl = document.getElementById('prof-header-foto');
            if (nomeEl) nomeEl.textContent = data.nome || '';
            if (cargoEl) cargoEl.textContent = data.cargo || '';
            if (fotoEl && data.foto_url) fotoEl.src = data.foto_url;
            App.finishLogin();
            return;
        } catch (e) {
            localStorage.removeItem('hairconcept_prof_dados');
        }
    }

    // Link de recuperação de senha: o Supabase entrega o token na barra de endereços
    const hash = window.location.hash || '';
    const query = window.location.search || '';
    if (/type=recovery/.test(hash) || /type=recovery/.test(query) || /code=/.test(query)) {
        if (supabaseClient && supabaseClient.auth) {
            try {
                const { error } = await supabaseClient.auth.getSessionFromUrl
                    ? await supabaseClient.auth.getSessionFromUrl({ storeSession: true })
                    : { error: null };
                if (error) console.error('Erro ao ler o link de recuperação:', error);
            } catch (e) {
                console.error('Erro ao processar o link de recuperação:', e);
            }
            Auth.abrirModal('modal-nova-senha');
            return;
        }
    }

    // Admin: restaura a sessão do Supabase
    if (supabaseClient && supabaseClient.auth) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && !App.user.loggedIn) {
            const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
            App.user = { loggedIn: true, role: 'admin', name: name };
            App.finishLogin();
        }
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session && !App.user.loggedIn) {
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                App.user = { loggedIn: true, role: 'admin', name: name };
                App.finishLogin(`Bem-vindo, ${name}!`);
            }
        });
    }
});

