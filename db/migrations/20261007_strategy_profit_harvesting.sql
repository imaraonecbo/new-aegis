create table if not exists strategy_performance_metrics(
 id bigserial primary key,
 strategy_id text not null,
 symbol text,
 period_start timestamptz not null,
 period_end timestamptz not null,
 starting_capital numeric(38,18) not null,
 ending_equity numeric(38,18) not null,
 gross_pnl numeric(38,18) not null default 0,
 trading_fees numeric(38,18) not null default 0,
 slippage_drag numeric(38,18) not null default 0,
 funding_cost numeric(38,18) not null default 0,
 net_pnl numeric(38,18) not null default 0,
 return_pct numeric(30,12) not null default 0,
 trades_count integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists idx_strategy_metrics_strategy_period on strategy_performance_metrics(strategy_id,period_end desc);

create table if not exists revenue_sweeps(
 id bigserial primary key,
 asset text not null,
 destination text not null,
 starting_capital numeric(38,18) not null,
 high_water_mark numeric(38,18) not null,
 current_equity numeric(38,18) not null,
 net_pnl numeric(38,18) not null,
 harvest_pct numeric(12,8) not null,
 swept_amount numeric(38,18) not null,
 transfer_id text,
 status text not null check(status in ('PENDING','SUBMITTED','CONFIRMED','FAILED')),
 error_message text,
 created_at timestamptz not null default now()
);
create index if not exists idx_revenue_sweeps_created on revenue_sweeps(created_at desc);

create table if not exists portfolio_regime_allocations(
 id bigserial primary key,
 regime text not null,
 strategy_id text not null,
 weight numeric(12,8) not null,
 allocated_capital numeric(38,18) not null,
 observed_at timestamptz not null default now()
);
create index if not exists idx_regime_allocations_observed on portfolio_regime_allocations(observed_at desc);