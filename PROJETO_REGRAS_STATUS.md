# 🚀 Deploy Manager - Regras e Status

Este documento centraliza as diretrizes de desenvolvimento e o status do projeto **Deploy Manager**, localizado em `c:\SistemaAdr\deploy`.

## 📌 Visão Geral
O **Deploy Manager** é uma ferramenta interna desenvolvida para gerenciar e automatizar o deploy de aplicações (como o Sistema Transportadora e Gestão Fort Fruit) via SSH/SCP.

- **Tecnologia**: React 19 + TypeScript + Vite.
- **Estilização**: Tailwind CSS v4 + Framer Motion (para animações de interface).
- **Ícones**: Lucide React.
- **Funcionalidade Principal**: Interface para configuração de conexões SSH, seleção de arquivos para deploy e monitoramento de logs de transferência.

---

## 🛠️ Stack Tecnológica
- **Frontend**: React (Hooks, Refs).
- **Animações**: `motion` (Framer Motion).
- **Build Tool**: Vite.
- **Dependencies**: `lucide-react`, `clsx`, `tailwind-merge`.

---

## 📏 Regras de Desenvolvimento

1.  **Componentização**: Como o `App.tsx` está crescendo (~550 linhas), a regra é começar a extrair componentes menores (Ex: `ProjectCard`, `LogConsole`, `ConfigForm`) para a pasta `src/components/`.
2.  **Configurações**: As configurações de projeto devem seguir a interface definida no `INITIAL_PROJECTS` (host, port, user, localPath, etc).
3.  **Simulação vs Realidade**: Atualmente, os logs de deploy são simulados no frontend. Futuras implementações devem integrar com um backend Node.js (Express) que utilize bibliotecas como `ssh2-promise` ou `node-scp`.
4.  **Estilo**: Seguir o padrão "Glassmorphism" e Dark Mode já iniciado, utilizando intensamente classes utilitárias do Tailwind v4.

---

## 📊 Status do Projeto (Maio/2026)

### ✅ Finalizado / Estável
- [x] Layout base com Sidebar e Painel Principal.
- [x] Gerenciamento de múltiplos projetos na interface.
- [x] Formulário de configuração SSH/SCP funcional (estado local).
- [x] Seletor de arquivos para deploy com "File Tree" simulada.
- [x] Console de logs com auto-scroll.

### 🔄 Em Desenvolvimento / Recentemente Concluído
- [x] Migração para Tailwind CSS v4.
- [x] Ajustes na responsividade do layout.
- [x] Implementação de animações de transição entre abas.

### ⏳ Pendente / Próximos Passos
- [ ] Integração real com Backend (Express) para execução de comandos SSH.
- [ ] Persistência das configurações (atualmente em memória/mock).
- [ ] Implementação de sistema de chaves SSH (upload de `.pem` / `.pub`).

---

## 📝 Notas do Antigravity
> Este arquivo reside na pasta `deploy` e deve ser o ponto de referência para este projeto específico de automação de deploys.
