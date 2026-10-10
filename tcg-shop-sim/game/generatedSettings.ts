export const DEVELOPER_SETTINGS = {
  "game": {
    "starting_currency": 500,
    "starting_profit_margin": 1
  },
  "time": {
    "minutes_per_game_hour": 60,
    "default_action_minutes": 15,
    "travel_minutes_per_hop": 60,
    "exploration_minutes": 120
  },
  "world": {
    "district_travel_fee_per_hop": 5,
    "exploration_energy": 15,
    "full_day_round_trip_after_hops": 2,
    "desk_card_decay_rate": 0.05,
    "npc_daily_rip_volume_base": 500,
    "common_print_run_base": 100000,
    "uncommon_print_run_base": 50000,
    "rare_print_run_base": 25000,
    "super_rare_print_run_base": 10000,
    "legendary_print_run_base": 2500,
    "enchanted_print_run_base": 500
  },
  "energy": {
    "max_energy": 100,
    "pack_rip_cost": 5,
    "live_pack_rip_cost": 1,
    "card_sort_cost": 1,
    "store_visit_cost": 5,
    "box_open_cost": 2,
    "disney_trip_cost": 40,
    "energy_drink_restore": 50,
    "energy_drink_reputation": 5,
    "late_hour_cost_modifier": 1,
    "local_visit": 5,
    "adjacent_district_visit": 10,
    "forced_sleep_after_hours": 36,
    "forced_sleep_energy_fraction": 0.5
  },
  "products": {
    "default_cards_per_pack": 12,
    "default_packs_per_box": 24,
    "default_pack_price": 5.99,
    "default_box_price": 143.76,
    "default_run_size": 1000
  },
  "storage": {
    "container_drawers": 6,
    "minimum_cards_per_container": 300,
    "maximum_cards_per_container": 5400,
    "maximum_containers_per_location": 6,
    "desk_capacity": 50,
    "sealed_products_per_location": 200,
    "bedroom_cards_per_drawer": 50,
    "compact_cards_per_drawer": 100,
    "standard_cards_per_drawer": 300,
    "large_cards_per_drawer": 600,
    "warehouse_cards_per_drawer": 900,
    "compact_container_price": 75,
    "standard_container_price": 180,
    "large_container_price": 320,
    "warehouse_container_price": 500
  },
  "binders": {
    "classic_25_price": 50,
    "portfolio_35_price": 90,
    "showcase_45_price": 150,
    "classic_25_resale_fraction": 0.5,
    "portfolio_35_resale_fraction": 0.45,
    "showcase_45_resale_fraction": 0.4
  },
  "business": {
    "garage_daily_cost": 10,
    "shop_daily_cost": 100,
    "warehouse_daily_cost": 300,
    "garage_purchase_cost": 500,
    "shop_purchase_cost": 5000,
    "warehouse_purchase_cost": 20000,
    "worker_hire_cost": 1500,
    "worker_energy_boost": 100,
    "worker_margin_penalty": 0.1
  },
  "economy": {
    "energy_drink_price": 10
  },
  "live": {
    "queue_limit": 3,
    "standard_show_energy": 10,
    "singles_show_energy": 5,
    "rtyh_show_energy": 15,
    "platform_fee_fraction": 0.15,
    "low_search_energy": 2,
    "high_search_energy": 12,
    "high_search_hit_zone": 0.25,
    "low_search_hit_zone": 0.06,
    "high_search_arrow_speed": 0.7,
    "low_search_arrow_speed": 1.6,
    "vague_decline_traffic_penalty": 1,
    "specific_decline_traffic_penalty": 5,
    "sellable_decline_traffic_penalty": 8,
    "empty_queue_traffic_penalty": 3,
    "price_gap_fraction": 0.25,
    "price_gap_traffic_penalty": 2
  },
  "shipping": {
    "normal_delivery_days": 3,
    "expedited_delivery_days": 1,
    "fee_per_hop": 2,
    "expedited_fee_multiplier": 2
  },
  "redemption": {
    "packs_per_case": 144
  }
} as const;
