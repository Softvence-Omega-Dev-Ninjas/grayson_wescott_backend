export interface WorkoutListResponse {
  data: Workout[];
  links: {
    total: number;
  };
  explanation: string;
}

export interface Workout {
  id: string;
  trainer: Trainer;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
  duration: number;
  difficulty: Difficulty;
  visibility: Visibility;
  categories: Category[];
  preview: Preview;
  rating: number | null;
  locked: boolean;
  mixBgMusic: boolean;
  presentationStyle: string;
  skipWorkoutPreview: boolean;
  skipWorkoutCompletionScreen: boolean;
}

export interface Trainer {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Preview {
  url: string;
  poster: string;
  thumbnail: string;
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type Visibility = 'private' | 'public';
