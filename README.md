# 🗓️ HairConcept — Sistema de Gestão para Salão de Beleza

Aplicação web de gestão para salões de beleza: agenda de atendimentos, cadastro de clientes, equipe de profissionais, controle de produtos e vendas, comissões, avaliações e planos de assinatura.

O projeto é **multiestabelecimento**: cada salão tem seu próprio registro no banco e seus próprios dados, isolados por Row Level Security.

---

## 📌 Visão Geral e Contexto

Salões pequenos controlam a agenda em papel ou por WhatsApp, o que gera conflito de horário, perda de histórico do cliente e nenhuma visibilidade sobre comissão e faturamento. O HairConcept resolve isso com uma aplicação web leve — sem instalação — em que o salão abre a agenda, registra o serviço e o horário fica reservado, com o valor e a comissão do profissional calculados a partir do dado real da venda.

Além da agenda, o sistema cobre o que um salão precisa no dia a dia: caixa, fechamento de comissão, controle de estoque de produtos e recados internos entre a administração e a equipe.

---

## 🏗️ Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5, CSS3, JavaScript (Vanilla) |
| Backend / Banco | **Supabase** (PostgreSQL 17) |
| Autenticação | Supabase Auth + sessão própria de profissional |
| Segurança de dados | Row Level Security (RLS) ativada em todas as tabelas |
| Deploy | Vercel (integração contínua com a branch `main`) |

### Multiestabelecimento por código de salão

Toda requisição ao banco envia o cabeçalho `x-salao-codigo`. É por ele que o banco localiza o estabelecimento correto, de modo que os dados continuam acessíveis mesmo que a conta de login mude.

### Autenticação em dois papéis

O sistema distingue **dono do salão** e **profissional**, e cada um vê apenas a sua área:

- No login, o papel é gravado e é a única fonte de verdade para decidir qual tela abre.
- O profissional recebe um token de sessão criado na tabela `sessoes_profissional`, devolvido em toda chamada pelo cabeçalho `x-prof-token`. Sem esse token, o profissional não acessa nada.
- Ao entrar como salão, os dados residuais de profissional são limpos da sessão local — e vice-versa.

### Tratamento de erro para o usuário final

Os erros do banco são traduzidos para português antes de aparecer na tela. Códigos como `23505` (registro duplicado), `23503` (item com histórico vinculado), negação de RLS, sessão expirada e limite de tentativas ganham mensagem clara, enquanto o erro técnico original permanece no console para depuração.

---

## 🗄️ Modelo de Dados

O banco tem **23 tabelas**, todas com RLS ativada.

**Núcleo do estabelecimento**

| Tabela | Papel |
| --- | --- |
| `estabelecimentos` | raiz do sistema; nome, contato, CNPJ, endereço e plano, vinculado a `auth.users` |
| `profissionais` | equipe do salão, com cargo, documento e percentual de comissão |
| `clientes` | cadastro de clientes, com histórico de avaliação e observação interna |
| `agendamentos` | data, horário de início e fim, cliente, serviço e valor |

**Operação e financeiro**

| Tabela | Papel |
| --- | --- |
| `servicos` | catálogo de serviços com preço e comissão |
| `produtos` | estoque, com preço de custo, preço de venda e validade |
| `vendas_produtos` | saída de produto com profissional, quantidade e comissão gerada |
| `transacoes_caixa` | movimentações de caixa do estabelecimento |
| `fechamentos` | fechamento por profissional |
| `comissoes_pagas` | registro de comissão quitada |
| `comissoes_tipo` | parametrização dos tipos de comissão |
| `recibos` | recibos vinculados ao agendamento |

**Relacionamento e comunicação**

| Tabela | Papel |
| --- | --- |
| `avaliacoes` | nota de 1 a 5 com comentário, validada por constraint |
| `avaliacoes_cliente` | avaliação por profissional vinculada ao cliente |
| `recados` | mensagens internas entre administração e equipe |
| `solicitacoes` | pedidos internos |

**Agenda e disponibilidade**

| Tabela | Papel |
| --- | --- |
| `turnos` | turnos de trabalho por profissional |
| `bloqueios` | indisponibilidades na agenda |

**Assinatura, segurança e conteúdo**

| Tabela | Papel |
| --- | --- |
| `planos` | planos do salão, com preço, limite de profissionais e identificador de cobrança |
| `sessoes_profissional` | tokens de sessão da área do profissional |
| `tentativas_login` | controle de tentativas de acesso por estabelecimento |
| `certificados` | certificados da equipe |
| `cursos` | conteúdo de formação |

---

## 🚀 Instruções de Execução

**1. Clone o repositório**

```bash
git clone https://github.com/rodrigocode2/agenda-de-salao2.git
cd agenda-de-salao2
```

**2. Abra a aplicação**

O projeto não tem etapa de build nem dependências para instalar:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows (PowerShell)
start index.html
```

Ou sirva localmente:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

**3. Requisitos**

- Navegador atualizado (Chrome, Firefox, Edge ou Safari)
- Conexão com a internet, para comunicação com o Supabase

> **Deploy em produção:** [hairconceptbeta.vercel.app](https://hairconceptbeta.vercel.app)

---

## 📸 Demonstração Visual

![Demonstração da agenda do salão](agenda.jpg)

> Vídeo da interface em funcionamento: [`hero.mp4`](hero.mp4)

---

## 📂 Estrutura do Projeto

```
agenda-de-salao2/
├── index.html                     # Aplicação (agenda, clientes, equipe, gestão)
├── app.js                         # Lógica da aplicação e integração com Supabase
├── style.css                      # Estilos
├── privacidade.html               # Política de privacidade
├── agenda.jpg                     # Captura de tela
├── hero.mp4                       # Vídeo de demonstração
├── pop-biosseguranca-salao.pdf    # Procedimento operacional padrão
├── LICENSE                        # Licença MIT
└── .gitignore                     # Arquivos ignorados pelo Git
```

---

## 🔒 Boas Práticas Aplicadas

- **RLS ativada em todas as tabelas** — o isolamento entre salões é garantido no banco, não só na interface
- **Tratamento de erro traduzido** — a falha técnica vira mensagem compreensível, e o erro original fica no console
- **Data local calculada corretamente** — a formatação evita o deslocamento de dia causado por UTC
- `.gitignore` configurado para impedir envio de arquivos temporários e credenciais
- Licença MIT incluída
- Página de privacidade separada, explicitando o tratamento dos dados de clientes

---

## ⚠️ Limitações Conhecidas

**Testes com dados iniciais.** O banco está em fase de estruturação: as tabelas estão criadas e íntegras, mas o volume de dados ainda é pequeno.

**Chave publicável no cliente.** A aplicação usa a chave publicável do Supabase no navegador, que é o uso previsto para acesso público — a proteção efetiva vem das políticas de RLS, que estão ativas.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👤 Autor

**Rodrigo Nunes dos Santos**
Estudante de Ciência da Computação — UDF
[github.com/rodrigocode2](https://github.com/rodrigocode2) · rodrigo-n-s@live.com
