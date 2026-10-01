// Configuração oficial do Supabase
const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g2JwYeFICTnivZWJZTzWmg_XzHAUm3Z';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        localStorage.removeItem('hairconcept_prof_id');
        localStorage.removeItem('hairconcept_user_role');
        localStorage.removeItem('hairconcept_user_name');
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signOut();
        }
        location.reload();
    },
    loginSocial(provider) {
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signInWithOAuth({ provider: provider });
        } else {
            alert('Erro: Supabase não inicializado corretamente.');
        }
    }
};

const App = {
    user: { loggedIn: false, role: '', name: '', id: null },
    fotoBase64Temp: '',
    dataAtualCalendario: new Date(),

    init() {
        console.log("HairConcept inicializado com todas as ferramentas do Salão99.");
        this.renderizarCalendarioVisual();
        this.renderListaProfissionais();
        this.renderProdutos();
        this.renderAgendaGrid();
        this.carregarPostIts();
        this.popularSelectProfissionais();
        
        if (this.user.role === 'profissional') {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
        } else {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
        }
    },

    // CALENDÁRIO VISUAL ESTILO SALÃO99
    renderizarCalendarioVisual() {
        const container = document.getElementById('grelha-calendario-mes');
        const labelMesAno = document.getElementById('mes-ano-atual');
        if (!container) return;

        const ano = this.dataAtualCalendario.getFullYear();
        const mes = this.dataAtualCalendario.getMonth();

        const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        if (labelMesAno) labelMesAno.textContent = `${nomesMeses[mes]} ${ano}`;

        const primeiroDiaIndex = new Date(ano, mes, 1).getDay();
        const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
        const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();

        const dataInputFiltro = document.getElementById('filtro-data-agenda');
        const dataSelecionadaStr = dataInputFiltro ? dataInputFiltro.value : new Date().toISOString().split('T')[0];

        let html = '';

        // Dias do mês anterior
        for (let i = primeiroDiaIndex; i > 0; i--) {
            const diaNum = totalDiasMesAnterior - i + 1;
            html += `<div class="p-2 text-zinc-600 text-[11px] rounded-xl">${diaNum}</div>`;
        }

        // Dias do mês atual
        for (let d = 1; d <= totalDiasMes; d++) {
            const mesStr = String(mes + 1).padStart(2, '0');
            const diaStr = String(d).padStart(2, '0');
            const dataCompleta = `${ano}-${mesStr}-${diaStr}`;
            const isHoje = dataCompleta === new Date().toISOString().split('T')[0];
            const isSelecionado = dataCompleta === dataSelecionadaStr;

            let classes = "p-2 rounded-xl transition-all cursor-pointer font-medium text-[11px] ";
            if (isSelecionado) {
                classes += "bg-brand-500 text-zinc-950 font-bold shadow-lg shadow-brand-500/20";
            } else if (isHoje) {
                classes += "border border-brand-500 text-brand-400";
            } else {
                classes += "text-zinc-300 hover:bg-zinc-800 hover:text-white";
            }

            html += `<div onclick="App.selecionarDiaCalendario('${dataCompleta}')" class="${classes}">${d}</div>`;
        }

        container.innerHTML = html;
    },

    mudarMes(direcao) {
        this.dataAtualCalendario.setMonth(this.dataAtualCalendario.getMonth() + direcao);
        this.renderizarCalendarioVisual();
    },

    selecionarDiaCalendario(dataStr) {
        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput) {
            dataInput.value = dataStr;
        }
        this.renderizarCalendarioVisual();
        this.renderAgendaGrid();
    },

    // CALCULADORA PESSOAL DO PROFISSIONAL
    calcularGanhosPessoal() {
        const val = parseFloat(document.getElementById('prof-calc-val')?.value) || 0;
        const porc = parseFloat(document.getElementById('prof-calc-porc')?.value) || 50;
        const total = (val * porc) / 100;
        const resEl = document.getElementById('prof-calc-result');
        if (resEl) resEl.textContent = `R$ ${total.toFixed(2)}`;
    },

    // ENVIO DE RECADOS / NOTIFICAÇÕES PARA O SALÃO
    async enviarRecadoProfissional() {
        const texto = document.getElementById('prof-recado-texto')?.value.trim();
        if (!texto) {
            alert('Por favor, escreva uma mensagem antes de enviar.');
            return;
        }
        const profNome = localStorage.getItem('hairconcept_user_name') || 'Profissional';
        const estabId = localStorage.getItem('hairconcept_estab_id') || 'geral';
        
        try {
            const chaveStorage = `hairconcept_recados_${estabId}`;
            const recados = JSON.parse(localStorage.getItem(chaveStorage) || '[]');
            recados.unshift({
                remetente: profNome,
                texto: texto,
                data: new Date().toLocaleString('pt-BR'),
                lido: false
            });
            localStorage.setItem(chaveStorage, JSON.stringify(recados));
            alert('Recado enviado com sucesso para a administração do salão!');
            document.getElementById('prof-recado-texto').value = '';
        } catch (e) {
            alert('Erro ao enviar o recado.');
        }
    },

    async handleAtualizarMinhaFoto(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            const profId = localStorage.getItem('hairconcept_prof_id');
            if (!profId || !supabaseClient) return;
            try {
                await supabaseClient.from('profissionais').update({ foto_url: base64 }).eq('id', profId);
                document.getElementById('prof-header-foto').src = base64;
                alert('Foto de perfil atualizada com sucesso!');
            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsDataURL(file);
    },

    async renderAgendaGrid() {
        console.log("Agenda atualizada.");
    },
    async renderListaProfissionais() {},
    async renderProdutos() {},
    async carregarPostIts() {},
    async popularSelectProfissionais() {}
};

// Recuperação de sessão automática ao atualizar a página
window.addEventListener('DOMContentLoaded', () => {
    const savedRole = localStorage.getItem('hairconcept_user_role');
    const savedName = localStorage.getItem('hairconcept_user_name');

    if (savedRole && savedName) {
        App.user = { loggedIn: true, role: savedRole, name: savedName };
        document.getElementById('ecra-login')?.classList.add('hidden');
        document.getElementById('painel-principal')?.classList.remove('hidden');
        
        const emailDisplay = document.getElementById('utilizador-logado-email');
        if (emailDisplay) emailDisplay.textContent = savedName;

        App.init();
    }

    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                localStorage.setItem('hairconcept_user_role', 'admin');
                localStorage.setItem('hairconcept_user_name', name);
                App.user = { loggedIn: true, role: 'admin', name: name };
                location.reload();
            }
        });
    }
});// Configuração oficial do Supabase
const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g2JwYeFICTnivZWJZTzWmg_XzHAUm3Z';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        localStorage.removeItem('hairconcept_prof_id');
        localStorage.removeItem('hairconcept_user_role');
        localStorage.removeItem('hairconcept_user_name');
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signOut();
        }
        location.reload();
    },
    loginSocial(provider) {
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signInWithOAuth({ provider: provider });
        } else {
            alert('Erro: Supabase não inicializado corretamente.');
        }
    }
};

const App = {
    user: { loggedIn: false, role: '', name: '', id: null },
    fotoBase64Temp: '',
    dataAtualCalendario: new Date(),

    init() {
        console.log("HairConcept inicializado com todas as ferramentas do Salão99.");
        this.renderizarCalendarioVisual();
        this.renderListaProfissionais();
        this.renderProdutos();
        this.renderAgendaGrid();
        this.carregarPostIts();
        this.popularSelectProfissionais();
        
        if (this.user.role === 'profissional') {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
        } else {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
        }
    },

    // CALENDÁRIO VISUAL ESTILO SALÃO99
    renderizarCalendarioVisual() {
        const container = document.getElementById('grelha-calendario-mes');
        const labelMesAno = document.getElementById('mes-ano-atual');
        if (!container) return;

        const ano = this.dataAtualCalendario.getFullYear();
        const mes = this.dataAtualCalendario.getMonth();

        const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        if (labelMesAno) labelMesAno.textContent = `${nomesMeses[mes]} ${ano}`;

        const primeiroDiaIndex = new Date(ano, mes, 1).getDay();
        const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
        const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();

        const dataInputFiltro = document.getElementById('filtro-data-agenda');
        const dataSelecionadaStr = dataInputFiltro ? dataInputFiltro.value : new Date().toISOString().split('T')[0];

        let html = '';

        // Dias do mês anterior
        for (let i = primeiroDiaIndex; i > 0; i--) {
            const diaNum = totalDiasMesAnterior - i + 1;
            html += `<div class="p-2 text-zinc-600 text-[11px] rounded-xl">${diaNum}</div>`;
        }

        // Dias do mês atual
        for (let d = 1; d <= totalDiasMes; d++) {
            const mesStr = String(mes + 1).padStart(2, '0');
            const diaStr = String(d).padStart(2, '0');
            const dataCompleta = `${ano}-${mesStr}-${diaStr}`;
            const isHoje = dataCompleta === new Date().toISOString().split('T')[0];
            const isSelecionado = dataCompleta === dataSelecionadaStr;

            let classes = "p-2 rounded-xl transition-all cursor-pointer font-medium text-[11px] ";
            if (isSelecionado) {
                classes += "bg-brand-500 text-zinc-950 font-bold shadow-lg shadow-brand-500/20";
            } else if (isHoje) {
                classes += "border border-brand-500 text-brand-400";
            } else {
                classes += "text-zinc-300 hover:bg-zinc-800 hover:text-white";
            }

            html += `<div onclick="App.selecionarDiaCalendario('${dataCompleta}')" class="${classes}">${d}</div>`;
        }

        container.innerHTML = html;
    },

    mudarMes(direcao) {
        this.dataAtualCalendario.setMonth(this.dataAtualCalendario.getMonth() + direcao);
        this.renderizarCalendarioVisual();
    },

    selecionarDiaCalendario(dataStr) {
        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput) {
            dataInput.value = dataStr;
        }
        this.renderizarCalendarioVisual();
        this.renderAgendaGrid();
    },

    // CALCULADORA PESSOAL DO PROFISSIONAL
    calcularGanhosPessoal() {
        const val = parseFloat(document.getElementById('prof-calc-val')?.value) || 0;
        const porc = parseFloat(document.getElementById('prof-calc-porc')?.value) || 50;
        const total = (val * porc) / 100;
        const resEl = document.getElementById('prof-calc-result');
        if (resEl) resEl.textContent = `R$ ${total.toFixed(2)}`;
    },

    // ENVIO DE RECADOS / NOTIFICAÇÕES PARA O SALÃO
    async enviarRecadoProfissional() {
        const texto = document.getElementById('prof-recado-texto')?.value.trim();
        if (!texto) {
            alert('Por favor, escreva uma mensagem antes de enviar.');
            return;
        }
        const profNome = localStorage.getItem('hairconcept_user_name') || 'Profissional';
        const estabId = localStorage.getItem('hairconcept_estab_id') || 'geral';
        
        try {
            const chaveStorage = `hairconcept_recados_${estabId}`;
            const recados = JSON.parse(localStorage.getItem(chaveStorage) || '[]');
            recados.unshift({
                remetente: profNome,
                texto: texto,
                data: new Date().toLocaleString('pt-BR'),
                lido: false
            });
            localStorage.setItem(chaveStorage, JSON.stringify(recados));
            alert('Recado enviado com sucesso para a administração do salão!');
            document.getElementById('prof-recado-texto').value = '';
        } catch (e) {
            alert('Erro ao enviar o recado.');
        }
    },

    async handleAtualizarMinhaFoto(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            const profId = localStorage.getItem('hairconcept_prof_id');
            if (!profId || !supabaseClient) return;
            try {
                await supabaseClient.from('profissionais').update({ foto_url: base64 }).eq('id', profId);
                document.getElementById('prof-header-foto').src = base64;
                alert('Foto de perfil atualizada com sucesso!');
            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsDataURL(file);
    },

    async renderAgendaGrid() {
        console.log("Agenda atualizada.");
    },
    async renderListaProfissionais() {},
    async renderProdutos() {},
    async carregarPostIts() {},
    async popularSelectProfissionais() {}
};

// Recuperação de sessão automática ao atualizar a página
window.addEventListener('DOMContentLoaded', () => {
    const savedRole = localStorage.getItem('hairconcept_user_role');
    const savedName = localStorage.getItem('hairconcept_user_name');

    if (savedRole && savedName) {
        App.user = { loggedIn: true, role: savedRole, name: savedName };
        document.getElementById('ecra-login')?.classList.add('hidden');
        document.getElementById('painel-principal')?.classList.remove('hidden');
        
        const emailDisplay = document.getElementById('utilizador-logado-email');
        if (emailDisplay) emailDisplay.textContent = savedName;// Configuração oficial do Supabase
const SUPABASE_URL = 'https://wahtcnoszlqtrfccfjxe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g2JwYeFICTnivZWJZTzWmg_XzHAUm3Z';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const Auth = {
    logout() {
        localStorage.removeItem('hairconcept_estab_id');
        localStorage.removeItem('hairconcept_prof_id');
        localStorage.removeItem('hairconcept_user_role');
        localStorage.removeItem('hairconcept_user_name');
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signOut();
        }
        location.reload();
    },
    loginSocial(provider) {
        if (supabaseClient && supabaseClient.auth) {
            supabaseClient.auth.signInWithOAuth({ provider: provider });
        } else {
            alert('Erro: Supabase não inicializado corretamente.');
        }
    }
};

const App = {
    user: { loggedIn: false, role: '', name: '', id: null },
    fotoBase64Temp: '',
    dataAtualCalendario: new Date(),

    init() {
        console.log("HairConcept inicializado com todas as ferramentas do Salão99.");
        this.renderizarCalendarioVisual();
        this.renderListaProfissionais();
        this.renderProdutos();
        this.renderAgendaGrid();
        this.carregarPostIts();
        this.popularSelectProfissionais();
        
        if (this.user.role === 'profissional') {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
        } else {
            document.getElementById('painel-profissional-extra')?.classList.remove('hidden');
        }
    },

    // CALENDÁRIO VISUAL ESTILO SALÃO99
    renderizarCalendarioVisual() {
        const container = document.getElementById('grelha-calendario-mes');
        const labelMesAno = document.getElementById('mes-ano-atual');
        if (!container) return;

        const ano = this.dataAtualCalendario.getFullYear();
        const mes = this.dataAtualCalendario.getMonth();

        const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        if (labelMesAno) labelMesAno.textContent = `${nomesMeses[mes]} ${ano}`;

        const primeiroDiaIndex = new Date(ano, mes, 1).getDay();
        const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
        const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();

        const dataInputFiltro = document.getElementById('filtro-data-agenda');
        const dataSelecionadaStr = dataInputFiltro ? dataInputFiltro.value : new Date().toISOString().split('T')[0];

        let html = '';

        // Dias do mês anterior
        for (let i = primeiroDiaIndex; i > 0; i--) {
            const diaNum = totalDiasMesAnterior - i + 1;
            html += `<div class="p-2 text-zinc-600 text-[11px] rounded-xl">${diaNum}</div>`;
        }

        // Dias do mês atual
        for (let d = 1; d <= totalDiasMes; d++) {
            const mesStr = String(mes + 1).padStart(2, '0');
            const diaStr = String(d).padStart(2, '0');
            const dataCompleta = `${ano}-${mesStr}-${diaStr}`;
            const isHoje = dataCompleta === new Date().toISOString().split('T')[0];
            const isSelecionado = dataCompleta === dataSelecionadaStr;

            let classes = "p-2 rounded-xl transition-all cursor-pointer font-medium text-[11px] ";
            if (isSelecionado) {
                classes += "bg-brand-500 text-zinc-950 font-bold shadow-lg shadow-brand-500/20";
            } else if (isHoje) {
                classes += "border border-brand-500 text-brand-400";
            } else {
                classes += "text-zinc-300 hover:bg-zinc-800 hover:text-white";
            }

            html += `<div onclick="App.selecionarDiaCalendario('${dataCompleta}')" class="${classes}">${d}</div>`;
        }

        container.innerHTML = html;
    },

    mudarMes(direcao) {
        this.dataAtualCalendario.setMonth(this.dataAtualCalendario.getMonth() + direcao);
        this.renderizarCalendarioVisual();
    },

    selecionarDiaCalendario(dataStr) {
        const dataInput = document.getElementById('filtro-data-agenda');
        if (dataInput) {
            dataInput.value = dataStr;
        }
        this.renderizarCalendarioVisual();
        this.renderAgendaGrid();
    },

    // CALCULADORA PESSOAL DO PROFISSIONAL
    calcularGanhosPessoal() {
        const val = parseFloat(document.getElementById('prof-calc-val')?.value) || 0;
        const porc = parseFloat(document.getElementById('prof-calc-porc')?.value) || 50;
        const total = (val * porc) / 100;
        const resEl = document.getElementById('prof-calc-result');
        if (resEl) resEl.textContent = `R$ ${total.toFixed(2)}`;
    },

    // ENVIO DE RECADOS / NOTIFICAÇÕES PARA O SALÃO
    async enviarRecadoProfissional() {
        const texto = document.getElementById('prof-recado-texto')?.value.trim();
        if (!texto) {
            alert('Por favor, escreva uma mensagem antes de enviar.');
            return;
        }
        const profNome = localStorage.getItem('hairconcept_user_name') || 'Profissional';
        const estabId = localStorage.getItem('hairconcept_estab_id') || 'geral';
        
        try {
            const chaveStorage = `hairconcept_recados_${estabId}`;
            const recados = JSON.parse(localStorage.getItem(chaveStorage) || '[]');
            recados.unshift({
                remetente: profNome,
                texto: texto,
                data: new Date().toLocaleString('pt-BR'),
                lido: false
            });
            localStorage.setItem(chaveStorage, JSON.stringify(recados));
            alert('Recado enviado com sucesso para a administração do salão!');
            document.getElementById('prof-recado-texto').value = '';
        } catch (e) {
            alert('Erro ao enviar o recado.');
        }
    },

    async handleAtualizarMinhaFoto(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            const profId = localStorage.getItem('hairconcept_prof_id');
            if (!profId || !supabaseClient) return;
            try {
                await supabaseClient.from('profissionais').update({ foto_url: base64 }).eq('id', profId);
                document.getElementById('prof-header-foto').src = base64;
                alert('Foto de perfil atualizada com sucesso!');
            } catch (err) {
                console.error(err);
            }
        };
        reader.readAsDataURL(file);
    },

    async renderAgendaGrid() {
        console.log("Agenda atualizada.");
    },
    async renderListaProfissionais() {},
    async renderProdutos() {},
    async carregarPostIts() {},
    async popularSelectProfissionais() {}
};

// Recuperação de sessão automática ao atualizar a página
window.addEventListener('DOMContentLoaded', () => {
    const savedRole = localStorage.getItem('hairconcept_user_role');
    const savedName = localStorage.getItem('hairconcept_user_name');

    if (savedRole && savedName) {
        App.user = { loggedIn: true, role: savedRole, name: savedName };
        document.getElementById('ecra-login')?.classList.add('hidden');
        document.getElementById('painel-principal')?.classList.remove('hidden');
        
        const emailDisplay = document.getElementById('utilizador-logado-email');
        if (emailDisplay) emailDisplay.textContent = savedName;

        App.init();
    }

    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                localStorage.setItem('hairconcept_user_role', 'admin');
                localStorage.setItem('hairconcept_user_name', name);
                App.user = { loggedIn: true, role: 'admin', name: name };
                location.reload();
            }
        });
    }
});

        App.init();
    }

    if (supabaseClient && supabaseClient.auth) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                localStorage.setItem('hairconcept_user_role', 'admin');
                localStorage.setItem('hairconcept_user_name', name);
                App.user = { loggedIn: true, role: 'admin', name: name };
                location.reload();
            }
        });
    }
});
