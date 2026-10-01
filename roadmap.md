# SINA — Roadmap

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

## Próxima evolução de produto
- [ ] Central completa da turma com diário de classe.
- [ ] Frequência por aula/data com lançamento em lote.
- [ ] Calendário acadêmico institucional.
- [ ] Acompanhamento de conclusão de atividades pelo professor.
- [ ] Importação de alunos/turmas por CSV.
- [ ] Gestão administrativa de turmas, disciplinas e períodos.
- [ ] Relatórios acadêmicos exportáveis.
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
