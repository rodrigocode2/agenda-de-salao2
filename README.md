# 🗓️ Agenda Salão

Sistema web de **agendamento para salão de beleza**, desenvolvido para organizar horários, clientes e serviços em uma interface simples de usar no balcão ou no celular.

## 📌 Visão Geral e Contexto

Salões pequenos costumam controlar a agenda em papel ou em conversas de WhatsApp, o que gera conflito de horários, esquecimento de clientes e dificuldade para medir o movimento do dia. Este projeto resolve isso com uma aplicação web leve, sem necessidade de instalar nada: o atendente abre a agenda, registra o serviço e o horário fica reservado.

O projeto também inclui a **política de privacidade** do sistema e um **POP (Procedimento Operacional Padrão) de biossegurança** para o salão, porque um sistema de agendamento só é útil se estiver de acordo com a rotina real do estabelecimento.

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5, CSS3 |
| Lógica da aplicação | JavaScript (Vanilla) |
| Mídia | Vídeo de abertura (`hero.mp4`) e imagem de demonstração (`agenda.jpg`) |
| Versionamento | Git e GitHub |

## 🚀 Instruções de Execução

O projeto roda direto no navegador, sem build e sem dependências.

**1. Clone o repositório**

```bash
git clone https://github.com/rodrigocode2/agenda-de-salao2.git
cd agenda-de-salao2
```

**2. Abra a aplicação**

Basta abrir o arquivo `index.html` no navegador:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows (PowerShell)
start index.html
```

Ou, se preferir servir localmente com Python:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

**3. Requisitos**

- Navegador atualizado (Chrome, Firefox, Edge ou Safari)
- Nenhuma instalação adicional necessária

## 📸 Demonstração Visual

![Demonstração da agenda do salão](agenda.jpg)

> Vídeo da interface em funcionamento: [`hero.mp4`](hero.mp4)

## 📂 Estrutura do Projeto

```
agenda-de-salao2/
├── index.html                     # Página principal da agenda
├── privacidade.html               # Política de privacidade
├── style.css                      # Estilos da aplicação
├── app.js                         # Lógica de agendamento
├── agenda.jpg                     # Captura de tela
├── hero.mp4                       # Vídeo de demonstração
├── pop-biosseguranca-salao.pdf    # Procedimento operacional padrão
├── LICENSE                        # Licença MIT
└── .gitignore                     # Arquivos ignorados pelo Git
```

## 🔒 Boas Práticas Aplicadas

- Arquivo `.gitignore` configurado para impedir o envio de arquivos temporários e credenciais
- Licença MIT incluída
- Página de privacidade separada, deixando claro o tratamento dos dados de clientes
- Separação entre estrutura (HTML), estilo (CSS) e comportamento (JS)

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👤 Autor

**Rodrigo Nunes dos Santos**
Estudante de Ciência da Computação — UDF
[github.com/rodrigocode2](https://github.com/rodrigocode2) · rodrigo-n-s@live.com
