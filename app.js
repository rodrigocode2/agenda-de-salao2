const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g2JwYeFICTnivZWJZTzWmg_XzHAUm3Z';

// O site manda o CODIGO DO SALAO em toda chamada, num cabecalho proprio.
// Assim o banco encontra o salao mesmo que a conta de login mude.
const CODIGO_SALAO_PADRAO = 'deconcept2';
window.hcSalao = {
    get codigo() {
        try { return localStorage.getItem('hairconcept_codigo_salao') || CODIGO_SALAO_PADRAO; }
        catch (e) { return CODIGO_SALAO_PADRAO; }
    },
    definir(codigo) {
        try { localStorage.setItem('hairconcept_codigo_salao', String(codigo || '').trim().toLowerCase()); }
        catch (e) { /* silencioso */ }
    }
};

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
        headers: {
            get 'x-salao-codigo'() { return window.hcSalao.codigo; }
        }
    }
}) : null;

// Foto padrão (o site via.placeholder.com saiu do ar)
const FOTO_PADRAO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='150' height='150' fill='%2327272a'/%3E%3Ccircle cx='75' cy='58' r='26' fill='%2352525b'/%3E%3Crect x='32' y='96' width='86' height='40' rx='20' fill='%2352525b'/%3E%3C/svg%3E";

// Traduz erro tecnico para portugues claro. O erro original fica no Console.
function mensagemAmigavel(err) {
    const bruto = String((err && err.message) ? err.message : err || '');
    const codigo = String((err && err.code) ? err.code : '');
    const txt = (bruto + ' ' + codigo).toLowerCase();
    console.warn('Erro tecnico:', bruto, codigo);
    if (codigo === '429' || codigo === 'over_email_send_rate_limit' || codigo === 'over_request_rate_limit') {
        return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    }
    if (txt.indexOf('rate limit') >= 0 || txt.indexOf('too many') >= 0 || txt.indexOf('429') >= 0) {
        return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    }
    if (txt.indexOf('email address') >= 0 && txt.indexOf('invalid') >= 0) {
        return 'O e-mail interno nao foi aceito pelo servidor. Avise o suporte.';
    }
    if (txt.indexOf('signup') >= 0 && txt.indexOf('disabled') >= 0) {
        return 'O cadastro de novos acessos esta desligado no servidor. Avise o suporte.';
    }
    if (txt.indexOf('database error') >= 0 || txt.indexOf('saving new user') >= 0) {
        return 'O servidor recusou gravar este cadastro. Tente de novo em instantes.';
    }
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

// Fecha o menu do dia ao clicar fora
document.addEventListener('click', function (ev) {
    const pop = document.getElementById('menu-dia-pop');
    if (pop && !pop.classList.contains('hidden')) {
        if (!pop.contains(ev.target) && (!ev.target.closest || !ev.target.closest('.semana-menu-btn'))) {
            if (!pop.contains(ev.target)) pop.classList.add('hidden');
        }
    }
});

// Fecha qualquer modal aberto com a tecla Esc
document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay').forEach(function (m) {
        if (!m.classList.contains('hidden')) m.classList.add('hidden');
    });
});

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        localStorage.removeItem('hairconcept_prof_id');
        localStorage.removeItem('hairconcept_plan');
        localStorage.removeItem('hairconcept_prof_dados');
        localStorage.removeItem('hairconcept_plan_pendente');
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
    entrarDoSistema() {
        try { localStorage.setItem('hairconcept_viu_abertura', 'sim'); } catch (e) {}
        const tela = document.getElementById('tela-abertura');
        if (tela) {
            tela.classList.add('hc-sai');
            tela.style.display = 'none';
        }
        document.body.classList.remove('hc-abertura-ativa');
        document.body.style.overflow = '';
        try {
            document.querySelectorAll('.modal-overlay').forEach(function (m) { m.classList.add('hidden'); });
        } catch (e) {}
        try { UI.switchTab('aba-login'); } catch (e) {}
        setTimeout(function () {
            const t2 = document.getElementById('tela-abertura');
            if (t2) t2.style.display = 'none';
            document.body.classList.remove('hc-abertura-ativa');
        }, 400);
    },

    abrirLogin() {
        const tela = document.getElementById('tela-abertura');
        try { localStorage.setItem('hairconcept_viu_abertura', 'sim'); } catch (e) {}
        if (tela) tela.classList.add('hc-sai');
        const soltar = function () { try { Auth.liberarAbertura(); } catch (e) {} };
        setTimeout(soltar, 700);
        setTimeout(soltar, 1500);
        try { UI.switchTab('aba-login'); } catch (e) {}
    },

    prepararAbertura() {
        const tela = document.getElementById('tela-abertura');
        if (!tela) return;
        let jaViu = false;
        try { jaViu = localStorage.getItem('hairconcept_viu_abertura') === 'sim'; } catch (e) {}
        if (jaViu || (this.user && this.user.loggedIn)) {
            this.liberarAbertura();
            return;
        }
        document.body.classList.add('hc-abertura-ativa');
    },

    liberarAbertura() {
        const tela = document.getElementById('tela-abertura');
        if (tela) tela.style.display = 'none';
        document.body.classList.remove('hc-abertura-ativa');
        document.querySelectorAll('.modal-overlay').forEach(function (m) {
            m.classList.add('hidden');
        });
        document.body.style.overflow = '';
    },

    TIPOS_PROFISSIONAL: [
        { t: 'Cabeleireiro', p: 50 },
        { t: 'Barbeiro', p: 50 },
        { t: 'Colorista', p: 30 },
        { t: 'Escovista', p: 50 },
        { t: 'Manicure', p: 50 },
        { t: 'Pedicure', p: 50 },
        { t: 'Depiladora', p: 45 },
        { t: 'Esteticista', p: 45 },
        { t: 'Maquiador', p: 50 },
        { t: 'Design de sobrancelha', p: 50 },
        { t: 'Massoterapeuta', p: 45 },
        { t: 'Auxiliar', p: 10 }
    ],

    async carregarComissoesTipo() {
        const caixa = document.getElementById('lista-comissoes-tipo');
        if (!caixa) return;
        const estabId = await this.obterEstabId();
        const salvos = {};
        if (estabId) {
            try {
                const { data } = await supabaseClient
                    .from('comissoes_tipo').select('tipo, percentual')
                    .eq('estabelecimento_id', estabId);
                (data || []).forEach(function (r) { salvos[r.tipo] = Number(r.percentual); });
            } catch (e) { console.warn('Nao carreguei as comissoes:', e); }
        }
        caixa.innerHTML = '';
        this.TIPOS_PROFISSIONAL.forEach(function (tp) {
            const valor = (salvos[tp.t] !== undefined) ? salvos[tp.t] : tp.p;
            const linha = document.createElement('div');
            linha.className = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950 border border-white/10';
            linha.innerHTML = '<span class="text-xs text-zinc-200 font-bold uppercase">' + tp.t + '</span>' +
                '<input type="number" min="0" max="100" step="1" value="' + valor + '" ' +
                'data-tipo="' + tp.t + '" class="cfg-comissao w-24 glass-input rounded-xl px-3 py-2 text-xs text-white text-right">';
            caixa.appendChild(linha);
        });
    },

    async salvarComissoesTipo() {
        const estabId = await this.obterEstabId();
        if (!estabId) { UI.showToast('Não encontrei o seu salão.', 'error'); return; }
        const campos = document.querySelectorAll('.cfg-comissao');
        const linhas = [];
        campos.forEach(function (c) {
            let v = Number(c.value);
            if (isNaN(v)) v = 0;
            if (v < 0) v = 0;
            if (v > 100) v = 100;
            linhas.push({ estabelecimento_id: estabId, tipo: c.getAttribute('data-tipo'), percentual: v });
        });
        if (!linhas.length) return;
        try {
            const { error } = await supabaseClient
                .from('comissoes_tipo')
                .upsert(linhas, { onConflict: 'estabelecimento_id,tipo' });
            if (error) throw error;
            UI.showToast('Comissões salvas!');
        } catch (e) {
            console.error('Erro ao salvar comissoes:', e);
            UI.showToast('Não consegui salvar as comissões. Tente de novo.', 'error');
        }
    },

    async salvarDadosFiscais() {
        const estabId = await this.obterEstabId();
        if (!estabId) { UI.showToast('Não encontrei o seu salão.', 'error'); return; }
        const val = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
        try {
            const { error } = await supabaseClient.from('estabelecimentos').update({
                inscricao_municipal: val('cfg-inscricao-municipal') || null,
                codigo_servico: val('cfg-codigo-servico') || null,
                aliquota_iss: Number(val('cfg-aliquota')) || 0
            }).eq('id', estabId).select('id');
            if (error) throw error;
            UI.showToast('Dados fiscais salvos!');
        } catch (e) {
            console.error('Erro ao salvar dados fiscais:', e);
            UI.showToast('Não consegui salvar os dados fiscais.', 'error');
        }
    },

    async carregarConfigSalao() {
        const estabId = await this.obterEstabId();
        if (!estabId) return;
        try {
            const { data } = await supabaseClient
                .from('estabelecimentos')
                .select('nome_salao, cnpj, email, whatsapp, endereco, cidade, uf, cep, instagram, horario_abertura, horario_fechamento, inscricao_municipal, codigo_servico, aliquota_iss')
                .eq('id', estabId).maybeSingle();
            if (!data) return;
            const por = function (id, v) { const el = document.getElementById(id); if (el && v !== null && v !== undefined) el.value = v; };
            por('cfg-nome-salao', data.nome_salao);
            por('cfg-cnpj', data.cnpj);
            por('cfg-email', data.email);
            por('cfg-whatsapp', data.whatsapp);
            por('cfg-endereco', data.endereco);
            por('cfg-cidade', data.cidade);
            por('cfg-uf', data.uf);
            por('cfg-cep', data.cep);
            por('cfg-instagram', data.instagram);
            por('cfg-abertura', (data.horario_abertura || '').slice(0, 5));
            por('cfg-fechamento', (data.horario_fechamento || '').slice(0, 5));
            por('cfg-inscricao-municipal', data.inscricao_municipal);
            por('cfg-codigo-servico', data.codigo_servico);
            por('cfg-aliquota', data.aliquota_iss);
        } catch (e) { console.warn('Erro ao carregar a configuração:', e); }
    },

    abrirModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const dHoje = el.querySelector('[data-preencher-hoje]');
        if (dHoje && !dHoje.value) {
            const hj = new Date();
            const iso = hj.getFullYear() + '-' + String(hj.getMonth() + 1).padStart(2, '0') + '-' + String(hj.getDate()).padStart(2, '0');
            dHoje.value = iso;
            try { if (App.aplicarHorariosLivres) App.aplicarHorariosLivres(); } catch (e) {}
        }
        el.classList.remove('hidden');
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('inset', '0', 'important');
        el.style.setProperty('z-index', '99999', 'important');
        el.style.setProperty('display', 'flex', 'important');
        el.style.setProperty('align-items', 'center', 'important');
        el.style.setProperty('justify-content', 'center', 'important');
        el.style.removeProperty('width');
        el.style.removeProperty('height');
        document.body.style.overflow = 'hidden';

        if (id === 'modal-marcar') {
            const sel = document.getElementById('agendamento-profissional');
            const vazio = !sel || !sel.options || sel.options.length === 0;
            if (vazio) { try { App.popularSelectProfissionais(); } catch (e) { console.warn(e); } }
        }
    },
    fecharModal(id) {
        document.querySelectorAll('[id="' + id + '"]').forEach(function (el) { el.classList.add('hidden'); });
        const algumaAberta = document.querySelector('.modal-overlay:not(.hidden)');
        if (!algumaAberta) document.body.style.overflow = '';
    },
    abrirCadastro() { this.abrirModal('modal-cadastro'); },
    abrirRecuperarSenha() { this.abrirModal('modal-recuperar'); },
    abrirAjuda() { this.abrirModal('modal-ajuda'); },

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
            window.history.replaceState({}, document.title, window.location.pathname);
            UI.showToast('Senha alterada com sucesso!');
            await App.verificarOuCriarEstabelecimento();
        } catch (e) {
            console.error('Erro ao salvar a senha:', e);
            UI.showToast('Erro inesperado ao salvar a senha.', 'error');
        }
    },

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
        console.log('HairConcept inicializado.');

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

        this.renderAgendaGrid();
        this.carregarPostIts();
        this.carregarRecadosEstabelecimento();
        this.proximaFrase();

        if (!ehProfissional) {
            this.renderListaProfissionais();
            this.renderProdutos();
            this.renderServicos();
            this.popularSelectProfissionais();
            this.carregarConfiguracoes();
            this.renderRelatorios();
            this.renderAvaliacoes();
            this.carregarAvisos();
            this.renderClientes();
            this.popularClientesAgenda();
            this.renderRanking();
            this.renderAvaliacao();
        }

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
        try { if (this.carregarModeloAgenda) await this.carregarModeloAgenda(); } catch (e) {}
        try { if (this.verificarExclusaoPendente) await this.verificarExclusaoPendente(); } catch (e) {}
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

            let { data: listaEstab, error } = await supabaseClient
                .from('estabelecimentos')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true })
                .limit(1);
            let estab = (listaEstab && listaEstab[0]) || null;

            const headerSub = document.getElementById('saloon-name-header');

            if (error) {
                console.warn('Nao consegui ler o salao:', error);
                return;
            }
            if (!estab) {
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
            const jaViu = localStorage.getItem('hairconcept_boasvindas_' + userId);
            if (!jaViu) {
                this.mostrarBoasVindas(estab || null);
                this._userIdBoasVindas = userId;
            } else {
                this.init();
            }
        } catch (e) {
            console.error('Erro ao verificar estabelecimento:', e);
            this.init();
        }
    },
    gerarCodigoSalao(nome) {
        return String(nome || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'salao';
    },

    async _salaoPorCodigo(codigo) {
        try {
            const { data } = await supabaseClient
                .from('estabelecimentos').select('id')
                .eq('codigo_acesso', String(codigo || '').trim().toLowerCase())
                .maybeSingle();
            return data ? data.id : null;
        } catch (e) { return null; }
    },

    async contarTentativas(codigo, chave) {
        const salaId = await this._salaoPorCodigo(codigo);
        if (!salaId) return 0;
        try {
            const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const { data } = await supabaseClient
                .from('tentativas_login').select('id')
                .eq('estabelecimento_id', salaId)
                .eq('chave_final', String(chave || '').slice(-2))
                .gte('tentou_em', desde);
            return (data || []).length;
        } catch (e) { return 0; }
    },

    async registrarTentativaFalha(codigo, chave) {
        const salaId = await this._salaoPorCodigo(codigo);
        if (!salaId) return 0;
        try {
            await supabaseClient.from('tentativas_login').insert([{
                estabelecimento_id: salaId,
                nome_digitado: '(site)',
                chave_final: String(chave || '').slice(-2)
            }]);
        } catch (e) { /* nao atrapalha o login */ }
        return await this.contarTentativas(codigo, chave);
    },

    async limparTentativas(salaId, chave) {
        if (!salaId) return;
        try {
            await supabaseClient.from('tentativas_login').delete()
                .eq('estabelecimento_id', salaId)
                .eq('chave_final', String(chave || '').slice(-2));
        } catch (e) { /* silencioso */ }
    },

    async loginProfissional(event) {
        event.preventDefault();
        const nomeEstabelecimento = document.getElementById('login-prof-estabelecimento').value.trim();
        const nomeDigitado = (document.getElementById('login-prof-nome')?.value || '').trim();
        const cpf = (document.getElementById('login-prof-id').value || '').replace(/\D/g, '');
        const senha = cpf;
        const normaliza = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (cpf.length !== 11) { UI.showToast('A chave de acesso tem 11 números.', 'error'); return; }
        const jaErrou = await this.contarTentativas(nomeEstabelecimento, cpf);
        if (jaErrou >= 4) {
            UI.showToast('Acesso travado por 15 minutos. Avise o salão para liberar.', 'error');
            return;
        }
        try {
            const { data: lista, error } = await supabaseClient.rpc('login_profissional_v2', {
                p_codigo: nomeEstabelecimento,
                p_nome: nomeDigitado,
                p_chave: cpf
            });
            const data = Array.isArray(lista) ? lista[0] : lista;
            if (error || !data || !data.id) {
                if (error) console.error('Erro no login do profissional:', error);
                const tent = await this.registrarTentativaFalha(nomeEstabelecimento, cpf);
                if (tent >= 4) {
                    UI.showToast('Acesso travado por 15 minutos. Avise o salão para liberar.', 'error');
                } else {
                    UI.showToast('Salão, nome ou chave incorretos. Tentativa ' + tent + ' de 4.', 'error');
                }
                return;
            }
            if (data.estabelecimento_id) {
                localStorage.setItem('hairconcept_estab_id', data.estabelecimento_id);
                if (data.codigo_acesso) window.hcSalao.definir(data.codigo_acesso);
                else if (data.nome_salao) window.hcSalao.definir(App.gerarCodigoSalao ? App.gerarCodigoSalao(data.nome_salao) : 'deconcept2');
                this.limparTentativas(data.estabelecimento_id, cpf);
            }
            localStorage.setItem('hairconcept_prof_id', data.id);
            if (data.token) localStorage.setItem('hairconcept_prof_token', data.token);

            const dadosProf = {
                id: data.id,
                nome: data.nome || '',
                cargo: data.cargo || '',
                foto_url: data.foto_url || '',
                estabelecimento_id: data.estabelecimento_id || '',
                nome_salao: data.nome_salao || nomeEstabelecimento
            };
            localStorage.setItem('hairconcept_prof_dados', JSON.stringify(dadosProf));

            this.user = { loggedIn: true, role: 'profissional', name: dadosProf.nome, id: dadosProf.id };
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

            this.carregarMinhaBarra();
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
            let idSalao = estabelecimentoId;
            if (!idSalao) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    const { data: estab, error: erroEstab } = await supabaseClient
                        .from('estabelecimentos')
                        .select('id')
                        .eq('user_id', session.user.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
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
            try {
                const { data: lim } = await supabaseClient.rpc('meu_limite_profissionais');
                if (lim && Number(lim) > 0) limiteMaximo = Number(lim);
                else if (planoAtual === 'mensal') limiteMaximo = 10;
                else if (planoAtual === 'anual') limiteMaximo = 30;
            } catch (e) {
                if (planoAtual === 'mensal') limiteMaximo = 10;
                else if (planoAtual === 'anual') limiteMaximo = 30;
            }

            if (count >= limiteMaximo) {
                UI.showToast(`Limite atingido! O plano atual permite apenas ${limiteMaximo} profissionais.`, 'error');
                return;
            }

            const elNome = document.getElementById('prof-nome');
            const elCargo = document.getElementById('prof-cargo');
            const elCpf = document.getElementById('prof-cpf');
            const elSenha = document.getElementById('prof-senha');
            if (!elNome || !elCargo || !elCpf) {
                UI.showToast('Abra a aba Equipe e recarregue a pagina antes de cadastrar.', 'error');
                return;
            }
            if (!elNome.value.trim()) { UI.showToast('Escreva o nome do profissional.', 'error'); elNome.focus(); return; }
            if (!elCargo.value.trim()) { UI.showToast('Escreva o cargo ou especialidade.', 'error'); elCargo.focus(); return; }
            if ((elCpf.value || '').replace(/\D/g, '').length !== 11) { UI.showToast('A chave de acesso precisa ter 11 números.', 'error'); elCpf.focus(); return; }
            const nome = document.getElementById('prof-nome').value.trim();
            const cargo = document.getElementById('prof-cargo').value.trim();
            const cpf = (document.getElementById('prof-cpf').value || '').replace(/\D/g, '');
            const senha = cpf;
            const foto_url = this.fotoBase64Temp || null;

            if (senha.length < 4) {
                UI.showToast('A senha precisa ter pelo menos 4 caracteres.', 'error');
                return;
            }

            const userIdInterno = null;
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
                    UI.showToast('Esta chave ja esta em uso na equipe: ' + (jaExiste.nome || '') + '.', 'error');
                    return;
                }
                if (!confirm('Profissional ja cadastrado: ' + (jaExiste.nome || '') + '\n\nDeseja reativar ele na equipe?\n\nOs dados e o historico serao mantidos.')) {
                    UI.showToast('Cadastro mantido como inativo. Nada foi alterado.');
                    return;
                }
                const atualizar = { nome: nome, cargo: cargo, foto_url: foto_url, ativo: true, estabelecimento: nomeEstabelecimentoHeader };
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
                UI.showToast('Essa chave já está em uso neste salão. Escolha outros 11 números.', 'error');
            } else {
                UI.showToast(mensagemAmigavel(err), 'error');
            }
        }
    },

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
        if (!confirm('Excluir este profissional?\n\nOs atendimentos antigos continuam com o nome dele. Se ele voltar, e so cadastrar de novo.')) return;
        try {
            const { data: apagados, error } = await supabaseClient
                .from('profissionais')
                .delete()
                .eq('id', id)
                .select('id');
            if (error) throw error;
            if (!apagados || apagados.length === 0) {
                UI.showToast('O servidor nao permitiu excluir. Saia e entre de novo com a conta dona do salao.', 'error');
                return;
            }
            UI.showToast('Cadastro excluido. Os atendimentos antigos ficam com o nome dele.');
            this.renderListaProfissionais();
            this.popularSelectProfissionais();
            this.renderRankingGestao();
            this.renderAgendaGrid();
            this.renderAgendaSemana();
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
            UI.showToast('Mensagem apagada.', 'success');
            this.carregarRecadosEstabelecimento();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },

    async enviarRespostaAdmin() {
        const input = document.getElementById('admin-resposta-input');
        const mensagem = input.value.trim();
        if (!mensagem) {
            UI.showToast('Escreva uma resposta antes de enviar.', 'error');
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
            UI.showToast('Resposta enviada!', 'success');
            input.value = '';
            this.carregarRecadosEstabelecimento();
        } catch (e) {
            UI.showToast(mensagemAmigavel(e), 'error');
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
            const { error } = await supabaseClient.rpc('registrar_ponto', {
                p_profissional_id: profId || null,
                p_cliente_id: clienteId,
                p_tipo: tipo,
                p_obs: obs
            });
            if (error) {
                console.error('Erro ao registrar voto:', error);
                UI.showToast(mensagemAmigavel(error), 'error');
                return;
            }
            Auth.fecharModal('modal-voto');
            UI.showToast(tipo === 'mais' ? 'Ponto registrado!' : 'Alerta registrado.');
            this.renderClientes();
            this.popularClientesAgenda();
            this.renderRanking();
            this.renderAvaliacao();
        } catch (e) {
            console.error('Erro inesperado ao votar:', e);
            UI.showToast('Erro inesperado ao registrar.', 'error');
        }
    },

    calcularEstrelaProf(pontos, totalClientes) {
        const base = totalClientes > 0 ? totalClientes : 1;
        const negativo = pontos < 0;
        const progresso = negativo ? 0 : Math.min(pontos / base, 1);
        const cheias = Math.max(0, Math.floor(progresso * 5));
        const resto = negativo ? 0 : (progresso * 5) - cheias;
        const meia = resto >= 0.5;
        return {
            pontos: pontos,
            total: base,
            progresso: progresso,
            negativo: negativo,
            cheias: cheias,
            meia: meia,
            vazias: Math.max(0, 5 - cheias - (meia ? 1 : 0))
        };
    },

    _tipoAvaliacao: 'prof',

    trocarTipoAvaliacao(tipo) {
        this._tipoAvaliacao = (tipo === 'cli') ? 'cli' : 'prof';
        const bp = document.getElementById('btn-aval-prof');
        const bc = document.getElementById('btn-aval-cli');
        const ativo = 'flex-1 px-4 py-3 rounded-2xl bg-brand-500/15 text-brand-500 text-xs font-bold uppercase transition flex items-center justify-center gap-2';
        const inativo = 'flex-1 px-4 py-3 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white text-xs font-bold uppercase transition flex items-center justify-center gap-2';
        if (bp) bp.className = this._tipoAvaliacao === 'prof' ? ativo : inativo;
        if (bc) bc.className = this._tipoAvaliacao === 'cli' ? ativo : inativo;
        const busca = document.getElementById('aval-busca');
        if (busca) busca.value = '';
        this.renderAvaliacao();
    },

    estrelasClienteHTML(pontos, total) {
        if (pontos < 0) {
            return '<span class="hc-cuidado"><i class="fa-solid fa-triangle-exclamation"></i> CUIDADO</span>';
        }
        const cheias = Math.max(0, Math.min(5, Math.round(pontos)));
        let html = '';
        for (let i = 0; i < cheias; i++) html += '<i class="fa-solid fa-star text-amber-400"></i>';
        for (let i = 0; i < 5 - cheias; i++) html += '<i class="fa-regular fa-star text-zinc-600"></i>';
        return html;
    },

    estrelasHTML(pontos, total) {
        if (pontos < 0) {
            return '<i class="fa-solid fa-star text-rose-500"></i>';
        }
        const e = this.calcularEstrelaProf(pontos, total);
        let html = '';
        for (let i = 0; i < e.cheias; i++) html += '<i class="fa-solid fa-star"></i>';
        if (e.meia) html += '<i class="fa-solid fa-star-half-stroke"></i>';
        for (let i = 0; i < e.vazias; i++) html += '<i class="fa-regular fa-star text-zinc-600"></i>';
        return html;
    },

    MOTIVOS: {
        prof: [
            { v: 'mais', t: 'Elogio do cliente' },
            { v: 'mais', t: 'Cliente voltou satisfeita' },
            { v: 'mais', t: 'Atendimento rapido e caprichado' },
            { v: 'menos', t: 'Reclamacao do cliente' },
            { v: 'menos', t: 'Atrasou o atendimento' },
            { v: 'menos', t: 'Faltou sem avisar' },
            { v: 'menos', t: 'Desmarcou em cima da hora' }
        ],
        cli: [
            { v: 'mais', t: 'Cliente facil de atender' },
            { v: 'mais', t: 'Elogiou a equipe' },
            { v: 'mais', t: 'Pontual e educada' },
            { v: 'menos', t: 'Deu trabalho no atendimento' },
            { v: 'menos', t: 'Atrasou ou faltou' },
            { v: 'menos', t: 'Desmarcou em cima da hora' },
            { v: 'menos', t: 'Reclamou sem motivo' }
        ]
    },

    async renderAvaliacao() {
        const container = document.getElementById('aval-lista');
        const totalEl = document.getElementById('aval-total-clientes');
        if (!container) return;
        const tipo = this._tipoAvaliacao || 'prof';
        const busca = (document.getElementById('aval-busca')?.value || '').trim().toLowerCase();
        const estabId = await this.obterEstabId();
        if (!estabId) return;

        container.innerHTML = '<p class="text-xs text-zinc-500">Carregando...</p>';
        try {
            const { count } = await supabaseClient
                .from('clientes').select('*', { count: 'exact', head: true })
                .eq('estabelecimento_id', estabId);
            const total = count || 0;
            if (totalEl) totalEl.textContent = total + ' cliente(s) na base';

            let lista = [];
            if (tipo === 'prof') {
                const { data } = await supabaseClient
                    .from('profissionais').select('id, nome, cargo, foto_url, cpf')
                    .eq('estabelecimento_id', estabId)
                    .order('nome');
                lista = (data || []).map(p => ({ id: p.id, nome: p.nome || '', sub: p.cargo || '', foto: p.foto_url, busca: (p.nome || '') + ' ' + (p.cargo || '') }));
            } else {
                const { data } = await supabaseClient
                    .from('clientes').select('id, nome, telefone, cpf')
                    .eq('estabelecimento_id', estabId)
                    .order('nome');
                lista = (data || []).map(c => ({ id: c.id, nome: c.nome || '', sub: 'final ' + String(c.telefone || c.cpf || '----').slice(-4), foto: null, busca: (c.nome || '') + ' ' + (c.telefone || '') + ' ' + (c.cpf || '') }));
            }

            if (busca) lista = lista.filter(i => i.busca.toLowerCase().includes(busca));

            const pontosMap = {};
            try {
                const { data: votos } = await supabaseClient
                    .from('avaliacoes_cliente').select('profissional_id, cliente_id, tipo')
                    .eq('estabelecimento_id', estabId);
                (votos || []).forEach(v => {
                    const chave = (tipo === 'prof') ? v.profissional_id : v.cliente_id;
                    if (!chave) return;
                    pontosMap[chave] = (pontosMap[chave] || 0) + (v.tipo === 'mais' ? 1 : -1);
                });
            } catch (e) { console.warn('Erro ao somar os pontos:', e); }

            const ordenada = lista.slice().sort((a, b) => (pontosMap[b.id] || 0) - (pontosMap[a.id] || 0));

            container.innerHTML = '';
            if (ordenada.length === 0) {
                container.innerHTML = '<p class="text-xs text-zinc-500">Nada encontrado. Cadastre na aba ' + (tipo === 'prof' ? 'Equipe' : 'Clientes') + '.</p>';
                this.renderRankingGestao(pontosMap, total, tipo);
                return;
            }

            ordenada.forEach(item => {
                const pontos = pontosMap[item.id] || 0;
                const est = this.calcularEstrelaProf(pontos, total);
                const negativo = pontos < 0;
                const card = document.createElement('div');
                card.className = 'p-4 rounded-2xl bg-zinc-950 border ' + (negativo ? 'border-rose-500/40' : 'border-white/10') + ' space-y-3';

                const topo = document.createElement('div');
                topo.className = 'flex items-center justify-between gap-3 flex-wrap';
                const info = document.createElement('div');
                const h4 = document.createElement('h4');
                h4.className = 'text-xs font-bold text-white uppercase';
                h4.textContent = item.nome;
                const sub = document.createElement('p');
                sub.className = 'text-[10px] text-brand-500';
                sub.textContent = item.sub;
                info.appendChild(h4); info.appendChild(sub);

                const dir = document.createElement('div');
                dir.className = 'text-right';
                const estrelas = document.createElement('div');
                estrelas.className = 'prof-estrelas';
                estrelas.innerHTML = this.estrelasHTML(pontos, total);
                const cont = document.createElement('span');
                cont.className = 'block text-[9px] ' + (negativo ? 'text-rose-400 font-bold' : 'text-zinc-500') + ' mt-0.5';
                cont.textContent = pontos + ' / ' + total;
                dir.appendChild(estrelas); dir.appendChild(cont);

                topo.appendChild(info); topo.appendChild(dir);

                const barra = document.createElement('div');
                barra.className = 'prof-barra';
                const cheia = document.createElement('div');
                cheia.className = 'prof-barra-cheia' + (negativo ? ' bg-rose-500' : '');
                cheia.style.width = Math.round(est.progresso * 100) + '%';
                barra.appendChild(cheia);

                const motivos = this.MOTIVOS[tipo];
                const linha = document.createElement('div');
                linha.className = 'flex items-center gap-2 flex-wrap';

                const sel = document.createElement('select');
                sel.className = 'flex-grow min-w-[180px] glass-input rounded-xl px-3 py-2 text-xs text-white';
                motivos.forEach(m => {
                    const o = document.createElement('option');
                    o.value = m.v + '|' + m.t;
                    o.textContent = (m.v === 'mais' ? '+1  ' : '−1  ') + m.t;
                    sel.appendChild(o);
                });

                const btnMais = document.createElement('button');
                btnMais.className = 'px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold uppercase transition cursor-pointer';
                btnMais.textContent = '+1';
                btnMais.onclick = () => this.registrarPontoProf(item.id, 'mais', sel.value.split('|')[1]);

                const btnMenos = document.createElement('button');
                btnMenos.className = 'px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 text-xs font-bold uppercase transition cursor-pointer';
                btnMenos.textContent = '−1';
                btnMenos.onclick = () => this.registrarPontoProf(item.id, 'menos', sel.value.split('|')[1]);

                linha.appendChild(sel); linha.appendChild(btnMais); linha.appendChild(btnMenos);

                card.appendChild(topo); card.appendChild(barra); card.appendChild(linha);
                container.appendChild(card);
            });

            this.renderRankingGestao(pontosMap, total, tipo);
        } catch (e) {
            console.warn('Erro na avaliacao:', e);
            container.innerHTML = '<p class="text-xs text-zinc-500">Nao foi possivel carregar agora.</p>';
        }
    },

    async renderRankingGestao(pontosMap, total, tipo) {
        const container = document.getElementById('ranking-gestao');
        if (!container) return;
        const estabId = await this.obterEstabId();
        if (!estabId) return;
        try {
            if (!pontosMap) {
                pontosMap = {};
                try {
                    const { data: votos } = await supabaseClient
                        .from('avaliacoes_cliente').select('profissional_id, cliente_id, tipo')
                        .eq('estabelecimento_id', estabId);
                    (votos || []).forEach(v => {
                        const chave = (tipo === 'cli') ? v.cliente_id : v.profissional_id;
                        if (!chave) return;
                        pontosMap[chave] = (pontosMap[chave] || 0) + (v.tipo === 'mais' ? 1 : -1);
                    });
                } catch (e) { /* segue sem ranking */ }
            }
            if (typeof total !== 'number') {
                const { count } = await supabaseClient.from('clientes').select('*', { count: 'exact', head: true }).eq('estabelecimento_id', estabId);
                total = count || 0;
            }
            const tabela = (tipo === 'cli') ? 'clientes' : 'profissionais';
            const { data } = await supabaseClient.from(tabela).select('id, nome').eq('estabelecimento_id', estabId);
            const lista = (data || []).map(x => ({ nome: x.nome || '', pontos: pontosMap[x.id] || 0 }))
                .sort((a, b) => b.pontos - a.pontos).slice(0, 5);

            container.innerHTML = '';
            if (lista.length === 0) {
                container.innerHTML = '<p class="text-[10px] text-zinc-500">Sem dados ainda.</p>';
                return;
            }
            lista.forEach((item, i) => {
                const l = document.createElement('div');
                l.className = 'flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-950 border border-white/5';
                const esq = document.createElement('span');
                esq.className = 'text-[11px] text-white font-bold';
                esq.textContent = (i + 1) + '. ' + item.nome;
                const dir = document.createElement('span');
                dir.className = 'text-[10px] ' + (item.pontos < 0 ? 'text-rose-400 font-bold' : 'text-zinc-400');
                dir.textContent = item.pontos + ' / ' + total;
                l.appendChild(esq); l.appendChild(dir);
                container.appendChild(l);
            });
        } catch (e) {
            console.warn('Erro no ranking:', e);
        }
    },

    async registrarPontoProf(profissionalId, tipo, motivo) {
        const estabId = await this.obterEstabId();
        if (!estabId) { UI.showToast('Nao encontrei o seu salao. Recarregue a pagina.', 'error'); return; }
        try {
            const { error } = await supabaseClient.rpc('registrar_ponto', {
                p_profissional_id: profissionalId,
                p_cliente_id: null,
                p_tipo: tipo,
                p_obs: motivo || null
            });
            if (error) throw error;
            UI.showToast(tipo === 'mais' ? 'Ponto registrado: ' + (motivo || '') : 'Alerta registrado: ' + (motivo || ''));
            this.renderAvaliacao();
            this.renderListaProfissionais();
        } catch (e) {
            console.error('Erro ao registrar ponto:', e);
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },

    async carregarMinhaBarra() {
        const caixa = document.getElementById('minha-barra-prof');
        if (!caixa) return;
        const token = localStorage.getItem('hairconcept_prof_token');
        const estabId = localStorage.getItem('hairconcept_estab_id');
        try {
            let pontos = 0, total = 0;
            if (token) {
                const { data } = await supabaseClient.rpc('meus_pontos', { p_token: token });
                const linha = Array.isArray(data) ? data[0] : data;
                if (linha) { pontos = Number(linha.pontos) || 0; total = Number(linha.total_clientes) || 0; }
            }
            if (!total && estabId) {
                const { count } = await supabaseClient.from('clientes').select('*', { count: 'exact', head: true }).eq('estabelecimento_id', estabId);
                total = count || 0;
            }
            const e = this.calcularEstrelaProf(pontos, total);
            const negativo = pontos < 0;
            caixa.innerHTML = '';
            const estrelas = document.createElement('div');
            estrelas.className = 'prof-estrelas text-lg';
            estrelas.innerHTML = this.estrelasClienteHTML(pontos, total);
            const barra = document.createElement('div');
            barra.className = 'prof-barra mt-2';
            const cheia = document.createElement('div');
            cheia.className = 'prof-barra-cheia' + (negativo ? ' bg-rose-500' : '');
            cheia.style.width = Math.round(e.progresso * 100) + '%';
            barra.appendChild(cheia);
            const cont = document.createElement('p');
            cont.className = 'text-[10px] mt-2 ' + (negativo ? 'text-rose-400 font-bold' : 'text-zinc-400');
            cont.textContent = pontos + ' / ' + total + ' cliente(s)';
            caixa.appendChild(estrelas); caixa.appendChild(barra); caixa.appendChild(cont);
        } catch (err) {
            console.warn('Nao foi possivel carregar a barra do profissional:', err);
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

    async registrarPontoCliente(clienteId, tipo, nomeCliente) {
        if (!clienteId) { UI.showToast('Cliente nao identificada.', 'error'); return; }
        const estabId = await this.obterEstabId();
        if (!estabId) { UI.showToast('Nao encontrei o seu salao. Recarregue a pagina.', 'error'); return; }
        try {
            const { error } = await supabaseClient.rpc('registrar_ponto', {
                p_profissional_id: null,
                p_cliente_id: clienteId,
                p_tipo: tipo,
                p_obs: tipo === 'mais' ? 'Cliente boa' : 'Cliente deu trabalho'
            });
            if (error) throw error;
            UI.showToast(
                tipo === 'mais'
                    ? (nomeCliente || 'Cliente') + ': ponto positivo registrado.'
                    : (nomeCliente || 'Cliente') + ': alerta registrado.'
            );
            this.renderClientes();
            this.popularClientesAgenda();
            this.renderAvaliacao();
        } catch (e) {
            console.error('Erro ao registrar ponto da cliente:', e);
            UI.showToast(mensagemAmigavel(e), 'error');
        }
    },

    async renderClientes() {
        this.ligarMascaraTelefone();
        const campoTel = document.getElementById('cli-telefone');
        if (campoTel && campoTel.dataset.maskLigada !== 'on') {
            campoTel.dataset.maskLigada = 'on';
            campoTel.addEventListener('input', function () {
                campoTel.value = App.mascaraTelefone(campoTel.value);
                App.guardarRascunho(['cli-nome','cli-telefone','cli-cpf','cli-email']);
            });
        }
        ['cli-nome','cli-telefone','cli-cpf','cli-email'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el && el.dataset.rascunho !== 'on') {
                el.dataset.rascunho = 'on';
                el.addEventListener('input', function () { App.guardarRascunho(['cli-nome','cli-telefone','cli-cpf','cli-email']); });
            }
        });
        this.devolverRascunho();
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
                btnMais.onclick = () => this.registrarPontoCliente(c.id, 'mais', c.nome);
                acoes.appendChild(btnMais);

                const btnMenos = document.createElement('button');
                btnMenos.className = 'px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-[10px] font-bold uppercase transition cursor-pointer';
                btnMenos.textContent = '-1';
                btnMenos.onclick = () => this.registrarPontoCliente(c.id, 'menos', c.nome);
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

    mascaraTelefone(valor) {
        const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
        if (d.length <= 2) return d;
        if (d.length <= 6) return '(' + d.slice(0,2) + ') ' + d.slice(2);
        if (d.length <= 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
        return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
    },

    ligarMascaraTelefone() {
        const campo = document.getElementById('cli-telefone');
        if (!campo || campo.dataset.mascara === 'on') return;
        campo.dataset.mascara = 'on';
        campo.setAttribute('inputmode', 'numeric');
        campo.setAttribute('maxlength', '15');
        campo.addEventListener('input', function () {
            campo.value = App.mascaraTelefone(campo.value);
        });
    },

    guardarRascunho(campos) {
        try {
            const dados = {};
            campos.forEach(function (id) {
                const el = document.getElementById(id);
                if (el && el.value) dados[id] = el.value;
            });
            if (Object.keys(dados).length) {
                localStorage.setItem('hairconcept_rascunho', JSON.stringify(dados));
            }
        } catch (e) { /* silencioso */ }
    },

    devolverRascunho() {
        try {
            const bruto = localStorage.getItem('hairconcept_rascunho');
            if (!bruto) return false;
            const dados = JSON.parse(bruto);
            let recuperou = false;
            Object.keys(dados).forEach(function (id) {
                const el = document.getElementById(id);
                if (el && !el.value) { el.value = dados[id]; recuperou = true; }
            });
            if (recuperou) UI.showToast('Recuperei o que voce tinha digitado.');
            return recuperou;
        } catch (e) { return false; }
    },

    limparRascunho() {
        try { localStorage.removeItem('hairconcept_rascunho'); } catch (e) {}
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

        if (telefone) {
            try {
                const soDigitos = String(telefone).replace(/\D/g, '');
                const { data: iguais } = await supabaseClient
                    .from('clientes').select('id, nome, telefone')
                    .eq('estabelecimento_id', estabId)
                    .ilike('telefone', '%' + soDigitos.slice(-8) + '%');
                if (iguais && iguais.length) {
                    const achado = iguais[0];
                    const seguir = confirm(
                        'Ja existe uma cliente com esse telefone:\n\n' +
                        achado.nome + '\n\n' +
                        'Deseja criar OUTRA ficha com o mesmo numero?\n' +
                        'Se for a mesma pessoa, use a ficha que ja existe.'
                    );
                    if (!seguir) { UI.showToast('Cadastro cancelado. A ficha que ja existe continua valendo.'); return; }
                }
            } catch (e) { /* nao trava o cadastro */ }
        }

        try {
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
            this.popularClientesAgenda();
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

        if (!id && !nome) { UI.showToast('Escreva o nome do cliente.', 'error'); return; }

        if (!id) {
            try {
                const estabId = await this.obterEstabId();
                if (!estabId) { UI.showToast('Não encontrei o seu salão. Recarregue a página.', 'error'); return; }
                const { error: erroNovo } = await supabaseClient.from('clientes').insert([{
                    estabelecimento_id: estabId,
                    nome: nome,
                    telefone: telefone || null,
                    cpf: cpf || null,
                    email: email || null
                }]);
                if (erroNovo) { console.error('Erro ao criar cliente:', erroNovo); UI.showToast(mensagemAmigavel(erroNovo), 'error'); return; }
                Auth.fecharModal('modal-editar-cliente');
                const campoNome = document.getElementById('cliente-nome');
                if (campoNome) campoNome.value = nome;
                UI.showToast('Cliente cadastrado!');
                this.renderClientes();
                this.popularClientesAgenda();
            } catch (e) {
                console.error('Erro inesperado ao criar cliente:', e);
                UI.showToast('Erro inesperado ao salvar o cliente.', 'error');
            }
            return;
        }

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
            this.popularClientesAgenda();
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
            this.popularClientesAgenda();
        } catch (e) {
            console.error('Erro inesperado ao excluir cliente:', e);
            UI.showToast('Erro inesperado ao excluir.', 'error');
        }
    },

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

            Auth.fecharModal('modal-trocar-senha');
            UI.showToast('Senha alterada! Passe a senha nova para o profissional.');
        } catch (e) {
            console.error('Erro inesperado ao editar:', e);
            UI.showToast('Erro inesperado ao salvar a senha.', 'error');
        }
    },

    abrirEditarProfissional(id, nome, cargo, cpf) {
        const campoId = document.getElementById('editar-prof-id');
        if (campoId) campoId.value = id;
        const campoNome = document.getElementById('editar-prof-nome');
        const campoCargo = document.getElementById('editar-prof-cargo');
        const campoCpf = document.getElementById('editar-prof-cpf');
        if (campoNome) campoNome.value = nome || '';
        if (campoCargo) campoCargo.value = cargo || '';
        if (campoCpf) campoCpf.value = cpf || '';
        const campoRecado = document.getElementById('recado-prof-id');
        if (campoRecado) campoRecado.value = id;
        const campoRecadoTxt = document.getElementById('recado-prof-texto');
        if (campoRecadoTxt) campoRecadoTxt.value = '';
        Auth.abrirModal('modal-editar-prof');
    },

    async enviarRecadoProfissional(event) {
        event.preventDefault();
        const id = document.getElementById('recado-prof-id')?.value;
        const texto = (document.getElementById('recado-prof-texto')?.value || '').trim();
        if (!id || !texto) { UI.showToast('Escreva a mensagem.', 'error'); return; }
        const estabId = await this.obterEstabId();
        if (!estabId) { UI.showToast('Nao encontrei o seu salao.', 'error'); return; }
        try {
            const { error } = await supabaseClient.from('recados').insert([{
                estabelecimento_id: estabId,
                profissional_id: id,
                remetente: 'salao',
                mensagem: texto
            }]);
            if (error) throw error;
            const campo = document.getElementById('recado-prof-texto');
            if (campo) campo.value = '';
            UI.showToast('Mensagem enviada para a aba do profissional.');
        } catch (e) {
            console.error('Erro ao enviar mensagem:', e);
            UI.showToast(mensagemAmigavel(e), 'error');
        }
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
            const chaveNova = String(cpf || '').replace(/\D/g, '');
            if (chaveNova.length === 11) {
                const { error: erroChave } = await supabaseClient.rpc('definir_senha_profissional', { p_id: id, p_senha: chaveNova });
                if (erroChave) console.warn('Chave nao regravada:', erroChave.message);
            }
            Auth.fecharModal('modal-editar-prof');
            UI.showToast('Dados do profissional atualizados!');
            this.renderListaProfissionais();
            this.popularSelectProfissionais();
            this.renderRankingGestao();
        } catch (e) {
            console.error('Erro inesperado ao editar:', e);
            UI.showToast('Erro inesperado ao salvar os dados.', 'error');
        }
    },

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

    async novoClienteDaAgenda() {
        const d = document.getElementById('agendamento-data');
        const p = document.getElementById('agendamento-profissional');
        this._clienteEdicaoId = null;
        ['editar-cli-nome', 'editar-cli-telefone', 'editar-cli-cpf', 'editar-cli-email'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const tit = document.getElementById('titulo-cliente');
        if (tit) tit.textContent = 'Novo Cliente';
        const dCli = document.getElementById('editar-cli-data');
        if (dCli && d) dCli.value = d.value;
        const pCli = document.getElementById('editar-cli-profissional');
        if (pCli && p && p.options) {
            pCli.innerHTML = '';
            for (let i = 0; i < p.options.length; i++) {
                const op = document.createElement('option');
                op.value = p.options[i].value; op.textContent = p.options[i].textContent;
                if (p.options[i].value === p.value) op.selected = true;
                pCli.appendChild(op);
            }
        }
        Auth.abrirModal('modal-editar-cliente');
    },

    async popularClientesAgenda() {
        const dl = document.getElementById('lista-clientes-agenda');
        if (!dl) return;
        try {
            let estabId = localStorage.getItem('hairconcept_estab_id');
            if (!estabId) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    const { data: lista } = await supabaseClient
                        .from('estabelecimentos').select('id')
                        .eq('user_id', session.user.id)
                        .order('created_at', { ascending: true }).limit(1);
                    estabId = lista && lista[0] ? lista[0].id : null;
                }
            }
            if (!estabId) return;
            const { data } = await supabaseClient
                .from('clientes').select('nome')
                .eq('estabelecimento_id', estabId)
                .order('nome', { ascending: true });
            dl.innerHTML = '';
            (data || []).forEach(function (c) {
                if (!c.nome) return;
                const op = document.createElement('option');
                op.value = c.nome;
                dl.appendChild(op);
            });
        } catch (e) { console.warn('Nao carreguei a lista de clientes:', e); }
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
                        .order('created_at', { ascending: false })
                        .limit(1)
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

    normalizarHora(v) { return String(v || '').slice(0, 5); },

    fimDoAtendimento(ag) {
        const inicio = this.minutosDoDia(this.normalizarHora(ag.horario));
        const temFim = !!(ag.horario_fim && this.normalizarHora(ag.horario_fim));
        const fim = temFim ? this.minutosDoDia(this.normalizarHora(ag.horario_fim)) : (inicio + 30);
        return fim > inicio ? fim : inicio + 30;
    },

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

    horariosLivres(agendamentos, profId) {
        const todos = [];
        for (let m = 480; m <= 1080; m += 30) {
            todos.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
        }
        if (!profId) return todos;
        return todos.filter(h => !this.horarioOcupado(agendamentos, profId, h));
    },

    async aplicarHorariosLivres() {
        const selProf = document.getElementById('agendamento-profissional');
        const campoHora = document.getElementById('agendamento-horario');
        const campoFim = document.getElementById('agendamento-horario-fim');
        const campoData = document.getElementById('agendamento-data');
        if (!selProf || !campoHora) return;

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

        if (elNome) elNome.textContent = temNome ? nomeSalao.trim() : 'Bem-vindo';
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
        const cpfLimpo = String(cpf || '').replace(/\D/g, '');
        const salaoCurto = String(idSalao || '').replace(/-/g, '').slice(0, 8);
        if (!cpfLimpo || !salaoCurto) return null;
        return `prof.${cpfLimpo}.${salaoCurto}@hairconcept.com.br`;
    },

    async obterEstabId() {
        let id = localStorage.getItem('hairconcept_estab_id');
        if (!supabaseClient || !supabaseClient.auth) return id || null;
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session || !session.user) return id || null;
            const codigo = (localStorage.getItem('hairconcept_codigo_salao') || '').trim().toLowerCase();
            if (codigo) {
                const { data: porCodigo } = await supabaseClient
                    .from('estabelecimentos')
                    .select('id')
                    .eq('codigo_acesso', codigo)
                    .maybeSingle();
                if (porCodigo && porCodigo.id) {
                    localStorage.setItem('hairconcept_estab_id', porCodigo.id);
                    return porCodigo.id;
                }
            }
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
                .order('created_at', { ascending: false })
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

    abrirEncaixe(pai) {
        if (!pai) return;
        this._modoEncaixe = true;
        const campoData = document.getElementById('agendamento-data');
        if (campoData) campoData.value = document.getElementById('filtro-data-agenda')?.value || dataLocalISO();

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

    hojeISO() { return dataLocalISO(); },

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

            let profId = this.user.id;
            if (!profId) {
                const { data: p } = await supabaseClient
                    .from('profissionais').select('id').eq('user_id', session.user.id).maybeSingle();
                if (p) profId = p.id;
            }
            if (!profId) return;
            this._profIdFech = profId;

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
                const de = inicio === '0001-01-01' ? 'o comeco' : inicio;
                elPeriodo.textContent = 'Período: ' + de + ' até hoje';
            }
            if (elQtd) elQtd.textContent = String(atendimentos.length);
            if (elValor) elValor.textContent = 'R$ ' + totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            if (lista) lista.innerHTML = '';
            if (hist) hist.innerHTML = '';
        } catch (e) {
            console.warn('Erro ao carregar fechamento do profissional:', e);
        }
    }
};

window.App = App;
window.Auth = Auth;
window.UI = window.UI || {};

if (window.addEventListener) {
    window.addEventListener('DOMContentLoaded', function () {
        try { if (Auth.prepararAbertura) Auth.prepararAbertura(); } catch (e) {}
        try { if (App.init) App.init(); } catch (e) { console.error('Erro ao iniciar App:', e); }
    });
}

window.supabaseClient = supabaseClient;
