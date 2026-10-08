# SINA — Roadmap

## Correção da prévia
- [x] Corrigir erros JSX e de tipagem sem alterar dados reais.
- [x] Verificar compilação automática e abertura das páginas.
- [ ] Disponibilizar RPCs de responsabilidade por disciplina, auditoria de notas e fechamento de períodos: migrações existentes não estão aplicadas no banco conectado; fora desta correção de compilação.

## Revisão cirúrgica da autenticação
- [x] Revisar marca, mensagens, Google, confirmação, recuperação e convites sem alterar regras acadêmicas.
- [x] Validar telas e erros; registrar limitações do Google gerenciado e do cliente gerado.
- [ ] Eliminar a identidade externa no consentimento Google: bloqueado pela integração gerenciada obrigatória deste projeto; identidade própria requer configuração das credenciais Google pelo responsável.
- [ ] Alterar a mensagem interna de configuração no cliente gerado: arquivo gerenciado não editável; mensagens exibidas nas telas foram neutralizadas.

## Fundação da plataforma
- [x] Preservar a identidade visual institucional do SINA.
- [x] Autenticação, recuperação de senha e áreas protegidas por função.
- [x] Separar perfil em rota autenticada independente.
- [x] RLS nas tabelas acadêmicas principais.
- [x] Estrutura multi-instituição inicial com instituições e memberships.
- [x] Turmas, professores de turma e disciplinas como entidades estruturadas.
- [x] Status de conta ativo/pendente/suspenso.
- [x] Roster seguro do professor sem exposição de claim_code/user_id.
- [x] Escritas acadêmicas críticas protegidas por RPCs autorizadas.
- [x] Lançamento de notas em lote transacional.
- [x] Central inicial de notificações do aluno.
- [x] Avisos e atividades com anexos, edição, exclusão e modelos.
- [x] Auditoria administrativa existente e integrada à área de administração.
- [x] Fluxo de cadastro com escolha de função e aprovação administrativa.
- [x] Onboarding com status pendente, rejeição, reenvio e notificação de decisão.

- [x] Avaliações com pesos, períodos e notas por aluno.
- [x] Entrega de atividades com correção e feedback.

## Próxima evolução de produto
- [x] Central completa da turma com diário de classe.
- [x] Frequência por aula/data com lançamento em lote.
- [x] Calendário acadêmico institucional.
- [x] Acompanhamento de conclusão de atividades pelo professor.
- [ ] Importação de alunos/turmas por CSV.
- [x] Gestão administrativa de turmas, disciplinas e períodos.
- [x] Relatórios acadêmicos exportáveis.
- [ ] Paginação e filtros server-side para grandes volumes.
- [ ] Convites institucionais e onboarding por instituição.
- [ ] Testes automatizados de autorização, RLS e fluxos críticos.
- [ ] Monitoramento de erros, performance e eventos de segurança.

## Verificação antes de escala pública
- [ ] Teste autenticado aluno/professor/admin no preview.
- [ ] Teste de isolamento entre duas instituições.
- [ ] Teste de carga para listas, notificações e lançamentos em lote.
- [ ] Revisão final de Storage/RLS e permissões das funções.
- [ ] Política de retenção e exportação dos dados.
