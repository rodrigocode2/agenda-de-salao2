
app.js

Code · JS




cria pra mim um readme. md pra eu postar no github


Vou montar o README.md com base no que o sistema realmente é — li o código inteiro nesta sessão, então sei o que documentar.


Usou Workspace
O README está pronto. Foi escrito a partir do que o código realmente faz — li o app.js e o index.html inteiros nesta sessão, então o que está documentado existe de verdade.

O que ele cobre
Seção	Conteúdo
Visão geral	O que é, onde roda (Vercel + Supabase)
O que o sistema faz	Tabela com as 10 áreas do salão + os 10 blocos da área do profissional
Tecnologia	HTML/CSS/JS puro, Tailwind CDN, Supabase, Mercado Pago, Vercel
Estrutura	Os três arquivos e o que cada um faz
Como funciona a sessão	A chave única hcSessao e a tabela de quem entra vê o quê
Banco	As 16 tabelas que o código usa, com a nota sobre Row Level Security
Publicando	Deploy automático na Vercel + como rodar local
Configuração	Onde ficam as credenciais, com aviso sobre a service_role
Segurança	RLS, o login do profissional por função, o limite de tentativas
Duas coisas que eu deixei explícitas no README
A sessão é o coração do sistema — ganhou seção própria. Foi lá que o bug do papel trocado viveu, e quem mexer no código depois precisa entender que uma chave decide a tela, não um dado que sobrou no navegador.

A chave service_role nunca vai para o front — está no README e no código. É o erro que derruba a segurança de qualquer sistema Supabase.

Sobe no GitHub
Cria o arquivo README.md na raiz do repositório (rodrigocode2/agenda-de-salao2) — pelo GitHub, botão Add file → Create new file, nome README.md, cola e commita. Ele aparece automaticamente na página inicial do repositório.

Uma coisa que eu não coloquei e que talvez você queira: o link do site e um screenshot. Se quiser, me manda a URL de produção que eu encaixo no topo — e uma das suas imagens pode virar o preview.

README.md

Markdown · MD




Pergunte qualquer coisa…




README.md

HairConcept — Gestão Integrada
Sistema web de gestão para salão de beleza: agenda, equipe, clientes, serviços, estoque, comissões, avaliações e uma área própria para o profissional.

Roda no navegador, sem instalação. Front-end estático na Vercel, dados no Supabase (Postgres).

O que o sistema faz
O HairConcept tem duas portas de entrada — o salão e o profissional — cada uma com a sua tela.

Para o salão
Área	O que tem
Agenda	Grade de atendimentos por dia e visão semanal, com filtro de data, navegação entre dias e "Saltar para mês"
Avisos	Pedidos de senha, reclamações e solicitações dos clientes
Equipe	Cadastro dos profissionais com foto, cargo, chave de acesso e senha
Clientes	Contatos do salão, com busca por nome, telefone ou CPF
Serviços e Estoque	Catálogo de procedimentos com preço e comissão, e controle de produtos
Cursos	Cursos, vídeos e materiais indicados para a equipe
Avaliação	Notas e feedback dos profissionais
Relatórios	Faturamento, atendimentos e clientes atendidos
Planos	Grátis, Mensal e Anual, com pagamento por PIX / QR Code
Configurações	Nome do salão, logo, CNPJ, endereço, redes sociais e horários
Para o profissional
Uma área enxuta, pensada para o celular:

Meus atendimentos — a agenda dele, dia a dia, com navegação entre datas
Meus números — atendimentos do dia e comissão
Minhas notas — post-its rápidos, com opção de baixar tudo em .txt
Calculadora de comissão — valor do serviço e percentual
Meu jeito — a cor do espaço dele e uma frase que aparece na agenda
Meu desempenho — barra de pontos recebidos
Cursos para fazer — o que o salão indicou
Meus certificados — envio por foto ou link; o certificado acende um selo 🎓 dourado no nome dele na agenda
Meu fechamento — quanto tem a receber
Chat com o salão
Tecnologia
HTML + CSS + JavaScript puro (sem build, sem framework)
Tailwind CSS via CDN para o layout
Supabase — autenticação e banco de dados (Postgres)
Mercado Pago — links de pagamento para os planos
Font Awesome e Google Fonts para ícones e tipografia
Vercel — hospedagem
Estrutura


index.html     estrutura das telas
style.css      todo o visual (glassmorphism, responsivo, semanal)
app.js         toda a lógica: login, agenda, equipe, dados
Como funciona a sessão
O sistema tem duas identidades — salão e profissional — e elas não se misturam.

No login, o papel é gravado numa chave única:

js


window.hcSessao.definir('salao');        // dono do salão
window.hcSessao.definir('profissional'); // profissional
E é só essa chave que decide qual tela abre. O sistema não deduz mais o papel por dados que sobraram no navegador — foi essa confusão que, em versões anteriores, jogava o dono do salão na área do profissional.

Ação	O que acontece
Salão entra	Grava salao, apaga os dados do profissional, abre a agenda do salão
Profissional entra	Grava profissional, abre a aba dele
Sai	Apaga a chave e volta para a tela de abertura
O profissional acessa com salão + nome + chave de 11 números. A senha é validada por uma função no banco, sem expor a tabela.

Banco de dados (Supabase)
Tabelas usadas pelo sistema:

estabelecimentos · profissionais · clientes · agendamentos · servicos · produtos · certificados · cursos · recados · avaliacoes · avaliacoes_cliente · fechamentos · bloqueios · comissoes_tipo · solicitacoes · tentativas_login

O acesso é controlado por Row Level Security: cada salão enxerga apenas os próprios dados. O profissional lê o que é dele por funções security definer, sem acesso direto às tabelas.

Publicando
O front é estático — basta servir os três arquivos.

Na Vercel: com o repositório conectado, cada push na branch main gera um deploy de produção automático.

Local: abra o index.html no navegador, ou rode um servidor simples:

bash


python3 -m http.server 8000
Configuração
As credenciais do Supabase ficam no topo do app.js:

js


const SUPABASE_URL = '[seu-projeto.supabase.co](https://SEU-PROJETO.supabase.co)';
const SUPABASE_ANON_KEY = 'sua-chave-anonima';
Use sempre a chave anon (pública, feita para o navegador). A chave service_role nunca deve ir para o front — ela ignora todas as regras de acesso.

Segurança
Row Level Security ligado em todas as tabelas
Cada registro é amarrado ao salão por estabelecimento_id
O profissional não tem conta no Supabase: entra por função no banco
Limite de tentativas de login do profissional (trava após 4 erros por 15 minutos)
Nenhuma chave sensível no front
Licença
Projeto privado. Todos os direitos reservados.
