export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items: Json
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      adicionais: {
        Row: {
          category_id: string | null
          controlar_estoque: boolean
          cost_price: number
          created_at: string
          estoque_minimo: number
          id: string
          nome: string
          preco: number
          quantidade_estoque: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          controlar_estoque?: boolean
          cost_price?: number
          created_at?: string
          estoque_minimo?: number
          id?: string
          nome: string
          preco?: number
          quantidade_estoque?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          controlar_estoque?: boolean
          cost_price?: number
          created_at?: string
          estoque_minimo?: number
          id?: string
          nome?: string
          preco?: number
          quantidade_estoque?: number
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          register_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          register_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          register_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          business_date: string
          closed_by_user_id: string | null
          closing_time: string | null
          created_at: string
          discrepancy_reason: string | null
          divergencia: number | null
          expected_balance: number
          fechado_automaticamente: boolean
          final_balance: number | null
          fundo_troco_deixado: number | null
          id: string
          initial_balance: number
          observacao_divergencia: string | null
          opening_time: string
          physical_balance: number | null
          saldo_real: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_date?: string
          closed_by_user_id?: string | null
          closing_time?: string | null
          created_at?: string
          discrepancy_reason?: string | null
          divergencia?: number | null
          expected_balance?: number
          fechado_automaticamente?: boolean
          final_balance?: number | null
          fundo_troco_deixado?: number | null
          id?: string
          initial_balance?: number
          observacao_divergencia?: string | null
          opening_time?: string
          physical_balance?: number | null
          saldo_real?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_date?: string
          closed_by_user_id?: string | null
          closing_time?: string | null
          created_at?: string
          discrepancy_reason?: string | null
          divergencia?: number | null
          expected_balance?: number
          fechado_automaticamente?: boolean
          final_balance?: number | null
          fundo_troco_deixado?: number | null
          id?: string
          initial_balance?: number
          observacao_divergencia?: string | null
          opening_time?: string
          physical_balance?: number | null
          saldo_real?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categoria_adicionais: {
        Row: {
          adicional_id: string
          category_id: string
          created_at: string
          id: string
        }
        Insert: {
          adicional_id: string
          category_id: string
          created_at?: string
          id?: string
        }
        Update: {
          adicional_id?: string
          category_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categoria_adicionais_adicional_id_fkey"
            columns: ["adicional_id"]
            isOneToOne: false
            referencedRelation: "adicionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categoria_adicionais_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sector: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sector?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sector?: string | null
          tipo?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          allow_whatsapp_promo: boolean | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          allow_whatsapp_promo?: boolean | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          allow_whatsapp_promo?: boolean | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      delivery_driver_users: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string
          email: string
          id: string
          restaurant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id: string
          email: string
          id?: string
          restaurant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string
          email?: string
          id?: string
          restaurant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_users_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          observacoes: string | null
          phone: string | null
          placa: string | null
          restaurant_id: string
          tipo_veiculo: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          observacoes?: string | null
          phone?: string | null
          placa?: string | null
          restaurant_id: string
          tipo_veiculo?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          observacoes?: string | null
          phone?: string | null
          placa?: string | null
          restaurant_id?: string
          tipo_veiculo?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      delivery_neighborhoods: {
        Row: {
          created_at: string
          fee: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_achievements: {
        Row: {
          code: string
          driver_id: string
          id: string
          points_awarded: number
          restaurant_id: string
          unlocked_at: string
        }
        Insert: {
          code: string
          driver_id: string
          id?: string
          points_awarded?: number
          restaurant_id: string
          unlocked_at?: string
        }
        Update: {
          code?: string
          driver_id?: string
          id?: string
          points_awarded?: number
          restaurant_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_achievements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_achievements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_breaks: {
        Row: {
          created_at: string
          driver_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          reason: Database["public"]["Enums"]["driver_break_reason"]
          restaurant_id: string
          shift_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["driver_break_reason"]
          restaurant_id: string
          shift_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["driver_break_reason"]
          restaurant_id?: string
          shift_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_breaks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_breaks_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_breaks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "driver_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings: {
        Row: {
          bonus_amount: number
          created_at: string
          delivery_fee: number
          discount_amount: number
          driver_id: string
          id: string
          notes: string | null
          order_id: string
          paid_at: string | null
          restaurant_id: string
          status: string
          total_earned: number
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          delivery_fee?: number
          discount_amount?: number
          driver_id: string
          id?: string
          notes?: string | null
          order_id: string
          paid_at?: string | null
          restaurant_id: string
          status?: string
          total_earned?: number
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          delivery_fee?: number
          discount_amount?: number
          driver_id?: string
          id?: string
          notes?: string | null
          order_id?: string
          paid_at?: string | null
          restaurant_id?: string
          status?: string
          total_earned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_event_logs: {
        Row: {
          actor_user_id: string | null
          created_at: string
          driver_id: string | null
          event: Database["public"]["Enums"]["driver_event_kind"]
          id: string
          metadata: Json
          restaurant_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          driver_id?: string | null
          event: Database["public"]["Enums"]["driver_event_kind"]
          id?: string
          metadata?: Json
          restaurant_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          driver_id?: string | null
          event?: Database["public"]["Enums"]["driver_event_kind"]
          id?: string
          metadata?: Json
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_event_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_event_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_goals: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          period: string
          restaurant_id: string
          target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          period: string
          restaurant_id: string
          target: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          period?: string
          restaurant_id?: string
          target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_goals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_goals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          current_order_id: string | null
          driver_id: string
          heading: number | null
          id: string
          is_online: boolean
          latitude: number
          longitude: number
          restaurant_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          current_order_id?: string | null
          driver_id: string
          heading?: number | null
          id?: string
          is_online?: boolean
          latitude: number
          longitude: number
          restaurant_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          current_order_id?: string | null
          driver_id?: string
          heading?: number | null
          id?: string
          is_online?: boolean
          latitude?: number
          longitude?: number
          restaurant_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_current_order_id_fkey"
            columns: ["current_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          dedupe_key: string
          driver_id: string
          id: string
          kind: Database["public"]["Enums"]["driver_notification_kind"]
          order_id: string | null
          read_at: string | null
          restaurant_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          dedupe_key: string
          driver_id: string
          id?: string
          kind: Database["public"]["Enums"]["driver_notification_kind"]
          order_id?: string | null
          read_at?: string | null
          restaurant_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          dedupe_key?: string
          driver_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["driver_notification_kind"]
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_points_ledger: {
        Row: {
          created_at: string
          description: string | null
          driver_id: string
          id: string
          order_id: string | null
          points: number
          reason: Database["public"]["Enums"]["driver_point_reason"]
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          driver_id: string
          id?: string
          order_id?: string | null
          points: number
          reason: Database["public"]["Enums"]["driver_point_reason"]
          restaurant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          driver_id?: string
          id?: string
          order_id?: string | null
          points?: number
          reason?: Database["public"]["Enums"]["driver_point_reason"]
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_points_ledger_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_points_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_points_ledger_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_route_history: {
        Row: {
          created_at: string
          destination: Json | null
          distance_meters: number | null
          driver_id: string
          duration_seconds: number | null
          id: string
          order_id: string | null
          origin: Json | null
          restaurant_id: string
          route_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination?: Json | null
          distance_meters?: number | null
          driver_id: string
          duration_seconds?: number | null
          id?: string
          order_id?: string | null
          origin?: Json | null
          restaurant_id: string
          route_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: Json | null
          distance_meters?: number | null
          driver_id?: string
          duration_seconds?: number | null
          id?: string
          order_id?: string | null
          origin?: Json | null
          restaurant_id?: string
          route_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_route_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_route_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_schedules: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string
          end_time: string
          id: string
          restaurant_id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id: string
          end_time: string
          id?: string
          restaurant_id: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string
          end_time?: string
          id?: string
          restaurant_id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_schedules_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_schedules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_shifts: {
        Row: {
          created_at: string
          driver_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          restaurant_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          restaurant_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string
          expense_date: string | null
          id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          description: string
          expense_date?: string | null
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string
          expense_date?: string | null
          id?: string
        }
        Relationships: []
      }
      historico_estoque: {
        Row: {
          criado_em: string
          id: string
          motivo: string | null
          order_id: string | null
          preco_custo_unitario: number | null
          produto_id: string
          quantidade: number
          responsavel_id: string | null
          tipo_movimentacao: string
        }
        Insert: {
          criado_em?: string
          id?: string
          motivo?: string | null
          order_id?: string | null
          preco_custo_unitario?: number | null
          produto_id: string
          quantidade: number
          responsavel_id?: string | null
          tipo_movimentacao: string
        }
        Update: {
          criado_em?: string
          id?: string
          motivo?: string | null
          order_id?: string | null
          preco_custo_unitario?: number | null
          produto_id?: string
          quantidade?: number
          responsavel_id?: string | null
          tipo_movimentacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_estoque_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "menu_items_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          last_order_at: string | null
          points: number | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_order_at?: string | null
          points?: number | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_order_at?: string | null
          points?: number | null
        }
        Relationships: []
      }
      menu_extras: {
        Row: {
          created_at: string | null
          id: string
          menu_item_id: string | null
          name: string
          price: number
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          name: string
          price?: number
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          name?: string
          price?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_extras_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_extras_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_public"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_ingredients: {
        Row: {
          created_at: string | null
          id: string
          menu_item_id: string | null
          quantity: number
          stock_item_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          quantity: number
          stock_item_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          quantity?: number
          stock_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_ingredients_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          controlar_estoque: boolean
          cost_price: number
          created_at: string | null
          description: string | null
          estoque_minimo: number
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          permitir_observacao: boolean
          placeholder_observacao: string
          price: number
          quantidade_estoque: number
          rating: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          controlar_estoque?: boolean
          cost_price?: number
          created_at?: string | null
          description?: string | null
          estoque_minimo?: number
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          permitir_observacao?: boolean
          placeholder_observacao?: string
          price: number
          quantidade_estoque?: number
          rating?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          controlar_estoque?: boolean
          cost_price?: number
          created_at?: string | null
          description?: string | null
          estoque_minimo?: number
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          permitir_observacao?: boolean
          placeholder_observacao?: string
          price?: number
          quantidade_estoque?: number
          rating?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string
          updated_at: string
        }
        Insert: {
          close_time?: string
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          cost_price_snapshot: number | null
          created_at: string
          extras: Json
          id: string
          menu_item_id: string | null
          notes: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          cost_price_snapshot?: number | null
          created_at?: string
          extras?: Json
          id?: string
          menu_item_id?: string | null
          notes?: string | null
          order_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          cost_price_snapshot?: number | null
          created_at?: string
          extras?: Json
          id?: string
          menu_item_id?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          order_id: string
          restaurant_id: string | null
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          order_id: string
          restaurant_id?: string | null
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          order_id?: string
          restaurant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          change_for: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_whatsapp: string | null
          delivery_address: string | null
          delivery_completed_at: string | null
          delivery_driver_id: string | null
          delivery_fee: number
          delivery_reference: string | null
          delivery_started_at: string | null
          delivery_status: string | null
          discount_amount: number | null
          discount_type: string | null
          id: string
          mesa_session: string | null
          needs_change: boolean | null
          payment_details: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          prepared_at: string | null
          service_fee: number | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          status_comanda: string | null
          status_financeiro: string | null
          stock_deducted: boolean
          table_number: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          change_for?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_whatsapp?: string | null
          delivery_address?: string | null
          delivery_completed_at?: string | null
          delivery_driver_id?: string | null
          delivery_fee?: number
          delivery_reference?: string | null
          delivery_started_at?: string | null
          delivery_status?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          mesa_session?: string | null
          needs_change?: boolean | null
          payment_details?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          prepared_at?: string | null
          service_fee?: number | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          status_comanda?: string | null
          status_financeiro?: string | null
          stock_deducted?: boolean
          table_number?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          change_for?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_whatsapp?: string | null
          delivery_address?: string | null
          delivery_completed_at?: string | null
          delivery_driver_id?: string | null
          delivery_fee?: number
          delivery_reference?: string | null
          delivery_started_at?: string | null
          delivery_status?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          mesa_session?: string | null
          needs_change?: boolean | null
          payment_details?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          prepared_at?: string | null
          service_fee?: number | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          status_comanda?: string | null
          status_financeiro?: string | null
          stock_deducted?: boolean
          table_number?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_driver_id_fkey"
            columns: ["delivery_driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          available_for: string[]
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_system: boolean
          name: string
          provider: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          available_for?: string[]
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean
          name: string
          provider?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          available_for?: string[]
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean
          name?: string
          provider?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_pix_settings: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          pix_key: string | null
          pix_key_type: string | null
          qr_code_url: string | null
          receiver_name: string | null
          static_pix_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          qr_code_url?: string | null
          receiver_name?: string | null
          static_pix_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          qr_code_url?: string | null
          receiver_name?: string | null
          static_pix_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_provider_settings: {
        Row: {
          access_token: string | null
          active: boolean | null
          api_key: string | null
          created_at: string | null
          environment: string | null
          id: string
          provider: string
          public_key: string | null
          restaurant_id: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          active?: boolean | null
          api_key?: string | null
          created_at?: string | null
          environment?: string | null
          id?: string
          provider: string
          public_key?: string | null
          restaurant_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          active?: boolean | null
          api_key?: string | null
          created_at?: string | null
          environment?: string | null
          id?: string
          provider?: string
          public_key?: string | null
          restaurant_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          paid_at: string | null
          payment_method: string
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: string
          provider_transaction_id: string | null
          raw_payload: Json | null
          restaurant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_transaction_id?: string | null
          raw_payload?: Json | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_transaction_id?: string | null
          raw_payload?: Json | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_adicionais: {
        Row: {
          adicional_id: string
          created_at: string
          id: string
          produto_id: string
        }
        Insert: {
          adicional_id: string
          created_at?: string
          id?: string
          produto_id: string
        }
        Update: {
          adicional_id?: string
          created_at?: string
          id?: string
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_adicionais_adicional_id_fkey"
            columns: ["adicional_id"]
            isOneToOne: false
            referencedRelation: "adicionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_adicionais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_adicionais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "menu_items_public"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_grupos_adicionais: {
        Row: {
          category_id: string
          created_at: string
          id: string
          produto_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          produto_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          produto_id?: string
        }
        Relationships: []
      }
      restaurant_settings: {
        Row: {
          aviso_ativo: boolean
          aviso_link: string | null
          aviso_mensagem: string | null
          aviso_titulo: string | null
          default_neighborhood_fee: number
          delivery_fee: number
          delivery_module_enabled: boolean
          force_closed: boolean
          id: string
          limite_virada_caixa: string
          total_tables: number
          updated_at: string
        }
        Insert: {
          aviso_ativo?: boolean
          aviso_link?: string | null
          aviso_mensagem?: string | null
          aviso_titulo?: string | null
          default_neighborhood_fee?: number
          delivery_fee?: number
          delivery_module_enabled?: boolean
          force_closed?: boolean
          id?: string
          limite_virada_caixa?: string
          total_tables?: number
          updated_at?: string
        }
        Update: {
          aviso_ativo?: boolean
          aviso_link?: string | null
          aviso_mensagem?: string | null
          aviso_titulo?: string | null
          default_neighborhood_fee?: number
          delivery_fee?: number
          delivery_module_enabled?: boolean
          force_closed?: boolean
          id?: string
          limite_virada_caixa?: string
          total_tables?: number
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          order_id: string | null
          rating: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          rating?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          created_at: string | null
          id: string
          min_quantity: number
          name: string
          quantity: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_quantity?: number
          name: string
          quantity?: number
          unit: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          min_quantity?: number
          name?: string
          quantity?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          avg_prep_time_mins: number | null
          custo_mes: number | null
          lucro_mes: number | null
          orders_by_source: Json | null
          orders_today: number | null
          revenue_last_week_same_day: number | null
          revenue_month: number | null
          revenue_today: number | null
          ticket_medio: number | null
          top_products: Json | null
          weekly_chart: Json | null
        }
        Relationships: []
      }
      menu_items_public: {
        Row: {
          category_id: string | null
          controlar_estoque: boolean | null
          created_at: string | null
          description: string | null
          estoque_minimo: number | null
          id: string | null
          image_url: string | null
          is_available: boolean | null
          name: string | null
          permitir_observacao: boolean | null
          placeholder_observacao: string | null
          price: number | null
          quantidade_estoque: number | null
          rating: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          controlar_estoque?: boolean | null
          created_at?: string | null
          description?: string | null
          estoque_minimo?: number | null
          id?: string | null
          image_url?: string | null
          is_available?: boolean | null
          name?: string | null
          permitir_observacao?: boolean | null
          placeholder_observacao?: string | null
          price?: number | null
          quantidade_estoque?: number | null
          rating?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          controlar_estoque?: boolean | null
          created_at?: string | null
          description?: string | null
          estoque_minimo?: number | null
          id?: string | null
          image_url?: string | null
          is_available?: boolean | null
          name?: string | null
          permitir_observacao?: boolean | null
          placeholder_observacao?: string | null
          price?: number | null
          quantidade_estoque?: number | null
          rating?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_stock_change: {
        Args: {
          p_id: string
          p_name?: string
          p_order_id: string
          p_qty: number
          p_type: string
        }
        Returns: undefined
      }
      apply_stock_for_order_item: {
        Args: {
          p_extras: Json
          p_menu_item_id: string
          p_multiplier: number
          p_order_id: string
          p_quantity: number
          p_type: string
        }
        Returns: undefined
      }
      deduct_stock_for_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      end_break: {
        Args: never
        Returns: {
          created_at: string
          driver_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          reason: Database["public"]["Enums"]["driver_break_reason"]
          restaurant_id: string
          shift_id: string
          started_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_active_shift: { Args: { _driver_id: string }; Returns: string }
      get_driver_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_driver_location_for_order: {
        Args: { _order_id: string }
        Returns: {
          accuracy: number
          created_at: string
          current_order_id: string
          driver_id: string
          heading: number
          id: string
          is_online: boolean
          latitude: number
          longitude: number
          restaurant_id: string
          speed: number
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_driver_event: {
        Args: { _event: string; _metadata?: Json }
        Returns: string
      }
      restore_stock_for_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      start_break: {
        Args: { _notes?: string; _reason: string }
        Returns: {
          created_at: string
          driver_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          reason: Database["public"]["Enums"]["driver_break_reason"]
          restaurant_id: string
          shift_id: string
          started_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "driver_breaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager"
      driver_break_reason: "meal" | "rest" | "personal" | "vehicle" | "other"
      driver_event_kind:
        | "login"
        | "clock_in"
        | "clock_out"
        | "break_start"
        | "break_end"
        | "delivery_accepted"
        | "delivery_rejected"
        | "location_update_rejected"
      driver_notification_kind:
        | "new_delivery"
        | "reassigned"
        | "delay_alert"
        | "inactivity"
        | "shift_reminder"
        | "customer_message"
      driver_point_reason:
        | "delivery"
        | "on_time_bonus"
        | "streak_5"
        | "streak_10"
        | "cancellation"
        | "achievement"
        | "manual"
      order_source: "mesa" | "online" | "delivery" | "pos"
      order_status:
        | "pending"
        | "preparing"
        | "delivered"
        | "cancelled"
        | "completed"
        | "ready"
      payment_method: "pix" | "card" | "cash"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "manager"],
      driver_break_reason: ["meal", "rest", "personal", "vehicle", "other"],
      driver_event_kind: [
        "login",
        "clock_in",
        "clock_out",
        "break_start",
        "break_end",
        "delivery_accepted",
        "delivery_rejected",
        "location_update_rejected",
      ],
      driver_notification_kind: [
        "new_delivery",
        "reassigned",
        "delay_alert",
        "inactivity",
        "shift_reminder",
        "customer_message",
      ],
      driver_point_reason: [
        "delivery",
        "on_time_bonus",
        "streak_5",
        "streak_10",
        "cancellation",
        "achievement",
        "manual",
      ],
      order_source: ["mesa", "online", "delivery", "pos"],
      order_status: [
        "pending",
        "preparing",
        "delivered",
        "cancelled",
        "completed",
        "ready",
      ],
      payment_method: ["pix", "card", "cash"],
    },
  },
} as const
