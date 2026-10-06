# SINA — Auditoria de qualidade — 06/10/2026

## Objetivo

Criar uma barreira automática para problemas estruturais antes de novas alterações nos três painéis.

## Verificações adicionadas

- existência das rotas e módulos acadêmicos críticos;
- existência do router e do route tree gerado;
- existência da camada central de dados;
- existência do CI;
- ausência de uma segunda árvore de rotas fora de src/routes;
- unicidade da versão timestamp das migrations;
- presença dos scripts de build, typecheck, lint e auditoria;
- presença das principais rotas no route tree gerado.

## Correção aplicada

A árvore legada routes/_authenticated/aluno.tsx foi removida. O SINA usa src/routes como fonte das rotas.

## Limitações

Esta auditoria é estrutural. Ela não substitui teste autenticado real nem valida isolamento entre duas instituições no banco.

## Próximas validações

1. CI: build + typecheck + lint + auditoria estática.
2. Teste autenticado de aluno, professor e administrador.
3. Teste de isolamento entre duas instituições.
4. Revisão de Storage/RLS e funções RPC.
5. Teste de volume para listas e gradebook.
