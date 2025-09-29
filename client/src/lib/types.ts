export interface TribunalOption {
  value: string;
  label: string;
}

export interface TribunalCategory {
  category: string;
  items: TribunalOption[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
