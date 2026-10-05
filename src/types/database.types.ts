export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      active_sessions: {
        Row: {
          id: string
          device_id: string
          user_id: string | null
          device_name: string | null
          permission: 'admin' | 'edit' | 'view'
          status: 'active' | 'revoked'
          last_active: string
        }
        Insert: {
          id?: string
          device_id: string
          user_id?: string | null
          device_name?: string | null
          permission?: 'admin' | 'edit' | 'view'
          status?: 'active' | 'revoked'
          last_active?: string
        }
        Update: {
          id?: string
          device_id?: string
          user_id?: string | null
          device_name?: string | null
          permission?: 'admin' | 'edit' | 'view'
          status?: 'active' | 'revoked'
          last_active?: string
        }
      }
      purchase_lots: {
        Row: {
          id: string
          user_id: string
          lot_number: number
          supplier_name: string | null
          supplier_phone: string | null
          total_price_main: number
          total_cost_main: number
          global_profit_percent: number
          paid_amount: number
          status: string
          password: string | null
          receiver_signature: string | null
          seller_signature: string | null
          created_at: string
          updated_at: string
        }
      }
      purchase_lot_items: {
        Row: {
          id: string
          lot_id: string
          user_id: string
          name: string
          total_kg: number | null
          weight_unit: string
          total_price: number | null
          profit_percent: number | null
          created_at: string
        }
      }
      sales_lots: {
        Row: {
          id: string
          user_id: string
          lot_number: number
          buyer_name: string | null
          buyer_phone: string | null
          total_amount: number
          discount: number
          net_total: number
          paid_amount: number
          status: string
          receiver_signature: string | null
          seller_signature: string | null
          created_at: string
          updated_at: string
        }
      }
      sales_lot_items: {
        Row: {
          id: string
          sales_lot_id: string
          user_id: string
          name: string
          total_kg: number | null
          rate_per_kg: number | null
          total_price: number | null
          created_at: string
        }
      }
      due_records: {
        Row: {
          id: string
          user_id: string
          due_type: 'regular' | 'permanent' | 'purchase' | 'sales'
          person_name: string
          phone: string | null
          address: string | null
          total_due: number
          paid_amount: number
          status: string
          due_date: string | null
          reminder_scheduled_for: string | null
          reminder_type: 'whatsapp' | 'sms' | null
          reminder_status: 'pending' | 'sent' | 'failed'
          notes: string | null
          receiver_signature: string | null
          seller_signature: string | null
          created_at: string
          updated_at: string
        }
      }
      due_memo_items: {
        Row: {
          id: string
          due_id: string
          user_id: string
          item_name: string
          quantity: number | null
          rate: number | null
          total: number | null
          created_at: string
        }
      }
      due_payments: {
        Row: {
          id: string
          due_id: string
          user_id: string
          amount_paid: number
          payment_method: string
          notes: string | null
          payment_date: string
        }
      }
      investors: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string | null
          address: string | null
          notes: string | null
          total_invested: number
          total_profit: number
          total_withdrawn: number
          current_balance: number
          created_at: string
          updated_at: string
        }
      }
      investor_memos: {
        Row: {
          id: string
          investor_id: string
          user_id: string
          memo_number: string | null
          status: 'active' | 'completed'
          completed_at: string | null
          investor_signature: string | null
          seller_signature: string | null
          created_at: string
          updated_at: string
        }
      }
      investor_transactions: {
        Row: {
          id: string
          memo_id: string
          investor_id: string
          user_id: string
          type: 'invest' | 'profit' | 'withdraw'
          description: string | null
          amount: number
          profit_percent: number | null
          net_total: number | null
          transaction_date: string
          created_at: string
        }
      }
      trash_items: {
        Row: {
          id: string
          user_id: string
          original_id: string | null
          type: string
          title: string
          data: Json
          deleted_at: string
        }
      }
      user_backups: {
        Row: {
          user_id: string
          key: string
          value: string
          updated_at: string
        }
      }
    }
  }
}
