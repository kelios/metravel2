export interface TravelCommentThread {
  id: number;
  travel: number | null;
  is_main: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface TravelComment {
  id: number;
  thread: number;
  sub_thread: number | null;
  user: number;
  text: string;
  created_at: string | null;
  updated_at: string | null;
  likes_count: number;
  user_name?: string;
  user_avatar?: string;
  is_liked?: boolean;
  is_author?: boolean;
}

export interface TravelCommentCreate {
  thread_id?: number;
  travel_id?: number;
  text: string;
}

export interface TravelCommentUpdate {
  text: string;
}
