# Руководство: Использование компонентов профиля

Краткая справка по использованию обновленных компонентов профиля после рефакторинга UI/UX.

---

## ProfileMenu

Dropdown-меню с кнопками действий (Настройки, Выйти).

### Импорт
```typescript
import { ProfileMenu } from '@/components/profile/ProfileMenu';
```

### Использование
```typescript
<ProfileMenu 
  onLogout={() => handleLogout()}
  onSettings={() => router.push('/settings')} // опционально
/>
```

### Пропсы
| Пропс | Тип | Обязательный | Описание |
|-------|-----|--------------|----------|
| `onLogout` | `() => void` | ✅ | Callback для выхода |
| `onSettings` | `() => void` | ❌ | Callback для перехода в настройки |

### Особенности
- Открывается по клику на "⋮"
- Автоматическое позиционирование через `measure()`
- Fallback позиция для тестовой среды
- Modal overlay закрывается при клике вне меню

---

## ProfileHeader

Шапка профиля с аватаром, именем, email и действиями.

### Импорт
```typescript
import { ProfileHeader } from '@/components/profile/ProfileHeader';
```

### Использование
```typescript
<ProfileHeader
  user={{
    name: 'Иван Иванов',
    email: 'ivan@example.com',
    avatar: 'https://...',
  }}
  profile={userProfile}
  onEdit={() => router.push('/settings')}
  onLogout={() => handleLogout()}
  onAvatarUpload={() => handleUpload()}
  avatarUploading={false}
/>
```

### Пропсы
| Пропс | Тип | Обязательный | Описание |
|-------|-----|--------------|----------|
| `user` | `{ name, email, avatar? }` | ✅ | Основная информация |
| `profile` | `UserProfileDto \| null` | ❌ | Полный профиль (для соц. сетей) |
| `onEdit` | `() => void` | ✅ | Callback для редактирования |
| `onLogout` | `() => void` | ✅ | Callback для выхода |
| `onAvatarUpload` | `() => void` | ✅ | Callback для загрузки аватара |
| `avatarUploading` | `boolean` | ❌ | Индикатор загрузки |

### Изменения
- ✅ Logout теперь в dropdown-меню
- ✅ Иконки соцсетей вместо текста
- ✅ Разделитель секции внизу

---

## ProfileStats

Статистика профиля (путешествия, избранное, просмотры).

### Импорт
```typescript
import { ProfileStats } from '@/components/profile/ProfileStats';
```

### Использование
```typescript
<ProfileStats
  stats={{
    travelsCount: 42,
    favoritesCount: 12,
    viewsCount: 156,
  }}
  onPressStat={(key) => {
    if (key === 'travels') setActiveTab('travels');
    if (key === 'favorites') setActiveTab('favorites');
    if (key === 'views') setActiveTab('history');
  }}
/>
```

### Пропсы
| Пропс | Тип | Обязательный | Описание |
|-------|-----|--------------|----------|
| `stats` | `{ travelsCount, favoritesCount, viewsCount }` | ✅ | Данные статистики |
| `onPressStat` | `(key) => void` | ❌ | Callback при нажатии |

### Изменения
- ✅ Иконки над числами (map-pin, heart, eye)
- ✅ Pressed scale анимация
- ✅ Hover shadow на web
- ✅ Accessibility улучшения

---

## ProfileTabs

Табы для переключения контента (Мои, Избранное, История).

### Импорт
```typescript
import { ProfileTabs } from '@/components/profile/ProfileTabs';
```

### Использование
```typescript
<ProfileTabs
  activeTab="travels"
  onChangeTab={(key) => setActiveTab(key)}
  counts={{
    travels: 42,
    favorites: 12,
    history: 156,
  }}
/>
```

### Пропсы
| Пропс | Тип | Обязательный | Описание |
|-------|-----|--------------|----------|
| `activeTab` | `'travels' \| 'favorites' \| 'history'` | ✅ | Активный таб |
| `onChangeTab` | `(key) => void` | ✅ | Callback при смене таба |
| `counts` | `{ travels?, favorites?, history? }` | ❌ | Количество для badges |

### Изменения
- ✅ Badges с количеством элементов
- ✅ Sticky position на web
- ✅ Accessibility улучшения

---

## ProfileQuickActions

Быстрые действия (Чаты, Подписки, Настройки).

### Импорт
```typescript
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
```

### Использование
```typescript
<ProfileQuickActions
  onPress={(key) => {
    if (key === 'messages') router.push('/messages');
    if (key === 'subscriptions') router.push('/subscriptions');
    if (key === 'settings') router.push('/settings');
  }}
  unreadMessagesCount={3}
/>
```

### Пропсы
| Пропс | Тип | Обязательный | Описание |
|-------|-----|--------------|----------|
| `onPress` | `(key) => void` | ✅ | Callback при нажатии |
| `unreadMessagesCount` | `number` | ❌ | Количество непрочитанных |

### Изменения
- ✅ "Профиль" → "Настройки"
- ✅ Chevron-right иконка
- ✅ Badge для непрочитанных
- ✅ Pressed/hover эффекты

---

## Пример полной интеграции

```typescript
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { ProfileTabs } from '@/components/profile/ProfileTabs';

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('travels');
  const [stats, setStats] = useState({
    travelsCount: 0,
    favoritesCount: 0,
    viewsCount: 0,
  });

  return (
    <SafeAreaView>
      <ProfileHeader
        user={{ name: 'User', email: 'user@example.com' }}
        onEdit={() => router.push('/settings')}
        onLogout={() => handleLogout()}
        onAvatarUpload={() => handleUpload()}
      />

      <ProfileQuickActions
        onPress={(key) => router.push(`/${key}`)}
        unreadMessagesCount={5}
      />

      <ProfileStats
        stats={stats}
        onPressStat={(key) => {
          if (key === 'views') setActiveTab('history');
          else setActiveTab(key);
        }}
      />

      <ProfileTabs
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        counts={stats}
      />

      {/* Content based on activeTab */}
    </SafeAreaView>
  );
}
```

---

## Миграция со старой версии

### ProfileHeader

**Было:**
```typescript
<ProfileHeader
  user={user}
  onEdit={onEdit}
  onLogout={onLogout} // кнопка в углу
/>
```

**Стало:**
```typescript
<ProfileHeader
  user={user}
  onEdit={onEdit}
  onLogout={onLogout} // в dropdown-меню
  onAvatarUpload={onAvatarUpload} // новый пропс
/>
```

### ProfileStats

**Было:**
```typescript
<ProfileStats stats={stats} />
// Без иконок, без анимаций
```

**Стало:**
```typescript
<ProfileStats 
  stats={stats}
  onPressStat={handlePress} // новый пропс
/>
// С иконками, анимациями, accessibility
```

### ProfileTabs

**Было:**
```typescript
<ProfileTabs
  activeTab={activeTab}
  onChangeTab={setActiveTab}
/>
// Без badges
```

**Стало:**
```typescript
<ProfileTabs
  activeTab={activeTab}
  onChangeTab={setActiveTab}
  counts={{ travels: 5, favorites: 10 }} // новый пропс
/>
// С badges, sticky, accessibility
```

### ProfileQuickActions

**Было:**
```typescript
<ProfileQuickActions onPress={handlePress} />
// "Профиль", без chevron, без badges
```

**Стало:**
```typescript
<ProfileQuickActions 
  onPress={handlePress}
  unreadMessagesCount={3} // новый пропс
/>
// "Настройки", chevron-right, badge для сообщений
```

---

## Troubleshooting

### ProfileMenu не открывается в тестах

**Проблема:** `measure()` не работает в React Native Testing Library.

**Решение:** Компонент имеет fallback позицию. Убедитесь, что Modal правильно мокается:

```typescript
// В вашем test setup
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // ... mock implementation
});
```

### Badges не показываются

**Проблема:** Не переданы counts.

**Решение:**
```typescript
<ProfileTabs
  counts={{
    travels: myTravels.length,
    favorites: favorites.length,
    history: viewHistory.length,
  }}
/>
```

### Иконки соцсетей не отображаются

**Проблема:** `profile` не передан или пустой.

**Решение:**
```typescript
<ProfileHeader
  profile={userProfile} // должен содержать youtube, instagram, twitter, vk
/>
```

---

**Версия:** 1.0.0  
**Дата обновления:** 2026-02-09

