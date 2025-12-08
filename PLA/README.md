# PLA (Painel do Administrador)

Este diretório é reservado para o novo painel/admin da plataforma. Enquanto o frontend específico não está pronto, já existem endpoints de administração expostos pela API para consulta de métricas e gestão.

## Autenticação admin
As rotas `/api/admin/**` agora usam o mesmo JWT de usuário, porém exigem que o usuário tenha `isAdmin = true` no banco.  
- Faça login com um usuário marcado como admin e envie o token no cookie/Bearer.  
- O antigo header `x-admin-token` não é mais usado.

## Endpoints atuais
- `GET /api/admin/stats` — Contagem de usuários, ativos (últimos 30 dias), total de apostas, somatório de saldos/bonus e totais de entrada/saída (depósitos, apostas, saques).
- `GET /api/admin/users?page=1&pageSize=20` — Lista paginada de usuários (id, nome, phone, saldo, bônus, criadoEm).
- `GET /api/admin/bets?page=1&pageSize=20` — Lista paginada de apostas com dados do usuário.
- `POST /api/admin/supervisors` | `GET /api/admin/supervisors` — Cadastro e listagem de supervisores (code único).
- `POST /api/admin/results` | `GET /api/admin/results` — Cadastro de resultado (loteria, código, data, números) e listagem; associa bets com a mesma loteria/código/data.
- `GET /api/admin/withdrawals` | `PATCH /api/admin/withdrawals/:id/status` — Listagem de solicitações de saque e atualização de status (pending/approved/rejected/paid). Marca transação de saque quando status for `paid`.
- `POST /api/admin/coupons` | `GET /api/admin/coupons` — Criação e listagem de cupons (type bonus/saldo, valor, ativo/expiração).

## Placeholders
Estão mapeadas rotas para supervisores, resultados, saques e cupons, porém retornam 501 até implementarmos a lógica:
N/A — endpoints acima já estão implementados em versão inicial.

## Próximos passos sugeridos
1) Definir autenticação/roles de admin no banco (ou JWT com flag `isAdmin`) em vez de `ADMIN_TOKEN`.  
2) Implementar rotas reais para supervisores (CRUD), resultados, associação de resultados às apostas, fluxo de saque/depósito e cupons.  
3) Construir o frontend do painel dentro desta pasta, consumindo os endpoints `/api/admin`.  
