export const MY_TRAVELS_FIXTURE = [
  { id: 101, title: 'My Travel 1' },
  { id: 102, title: 'My Travel 2' },
  { id: 103, title: 'My Travel 3' },
] as const;

export const SUBSCRIPTION_AUTHOR_FIXTURE = {
  id: 10,
  first_name: 'Иван',
  last_name: 'Петров',
  youtube: '',
  instagram: '',
  twitter: '',
  vk: '',
  avatar: '',
  user: 42,
} as const;

export const SUBSCRIBER_FIXTURE = {
  id: 20,
  first_name: 'Мария',
  last_name: 'Сидорова',
  youtube: '',
  instagram: '',
  twitter: '',
  vk: '',
  avatar: '',
  user: 55,
} as const;
