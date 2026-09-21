export type Role = 'admin' | 'user';

export interface Settings { currency: string }

export interface User { id: number; name: string; email: string; role: Role; phone?: string | null; created_at?: string; project_count?: number }

export interface Project {
  id: number; name: string; location?: string | null; description?: string | null; type: string;
  total_investment: number; status: string; created_at: string;
  item_count: number; rented_count: number; income: number; expense: number; net: number;
  shareholder_count: number; allocated_percent: number;
  share_percent?: number; invested_amount?: number; my_net?: number;
}

export interface Item {
  id: number; project_id: number; name: string; type: string; floor?: string | null; area_sqft?: number | null;
  expected_rent: number; status: 'vacant' | 'rented' | 'maintenance'; notes?: string | null; created_at: string;
  contract_id?: number | null; tenant_name?: string | null; business_name?: string | null; monthly_rent?: number | null; contract_end?: string | null;
}

export interface Contract {
  id: number; item_id: number; tenant_name: string; tenant_phone?: string | null; tenant_email?: string | null;
  tenant_id_number?: string | null; tenant_address?: string | null; business_name?: string | null;
  start_date: string; end_date: string; monthly_rent: number; deposit: number; payment_day: number;
  status: 'active' | 'expired' | 'terminated'; notes?: string | null; created_at: string;
  documents?: Doc[]; item_name?: string; project_id?: number; project_name?: string;
}

export interface Doc {
  id: number; project_id: number; item_id?: number | null; contract_id?: number | null; title: string; category: string;
  file_name: string; original_name: string; mime_type?: string; size?: number; created_at: string;
}

export interface Transaction {
  id: number; project_id: number; item_id?: number | null; contract_id?: number | null; type: 'income' | 'expense';
  category: string; amount: number; date: string; description?: string | null; item_name?: string | null;
}

export interface Feedback {
  id: number; user_id: number; project_id: number; item_id?: number | null; message: string;
  admin_reply?: string | null; replied_at?: string | null; created_at: string;
  user_name: string; project_name: string; item_name?: string | null;
}

export interface Monthly { month: string; income: number; expense: number; net: number; my_net?: number }

export interface Pnl {
  income: number; expense: number; net: number; monthly: Monthly[];
  byCategory: { type: 'income' | 'expense'; category: string; amount: number }[];
  share_percent?: number; my_income?: number; my_expense?: number; my_net?: number;
}

export interface Shareholder { id: number; user_id: number; share_percent: number; invested_amount: number; name: string; email?: string }

export interface ProjectDetail extends Project {
  items: Item[]; shareholders: Shareholder[]; documents: Doc[]; pnl: Pnl;
}

export interface ItemDetail extends Item {
  project: { id: number; name: string; location?: string | null };
  contracts: Contract[]; documents: Doc[]; transactions: Transaction[];
  income: number; expense: number; net: number;
}

export interface Portfolio {
  totals: { income: number; expense: number; net: number; items: number; rented: number; invested: number };
  monthly: Monthly[]; projects: Project[]; project_count: number; feedback_count: number;
  expiring_contracts: { id: number; tenant_name: string; end_date: string; item_name: string; project_name: string; project_id: number; item_id: number }[];
}
