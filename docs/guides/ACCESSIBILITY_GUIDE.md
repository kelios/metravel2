# Phase 2: Accessibility (WCAG AAA) - Quick Start Guide

## 🚀 Getting Started

### 1. Run the Tests
```bash
npm run test:run -- a11y.test.ts --no-coverage
```

Expected output: **28 passed ✅**

### 2. Test in Your App

```bash
npm run dev  # or your start command
```

Navigate to a travel details page and:
- Press **Tab** → Look for "Skip to main content" link appear
- Press **Tab again** → Focus should highlight buttons and links
- Press **Escape** → Should close modals if implemented

### 3. Check with Screen Reader (Optional)

**macOS/iOS:**
```bash
Cmd + F5  # Enable VoiceOver
```

**Windows:**
```bash
Windows + Ctrl + N  # Narrator
# or download NVDA: https://www.nvaccess.org/
```

---

## 📚 API Documentation

### Utilities (utils/a11y.ts)

#### Color Contrast
```typescript
import { checkContrast, isWCAG_AA, isWCAG_AAA } from '@/utils/a11y';

// Get raw contrast ratio
const ratio = checkContrast('#000000', '#FFFFFF');
console.log(ratio); // ≈ 21

// Check WCAG AA (4.5:1)
if (isWCAG_AA('#333333', '#FFFFFF')) {
  console.log('✅ AA Compliant');
}

// Check WCAG AAA (7:1)
if (isWCAG_AAA('#000000', '#FFFFFF')) {
  console.log('✅ AAA Compliant');
}
```

#### ARIA Helpers
```typescript
import { getAccessibilityLabel, getAccessibilityRole } from '@/utils/a11y';

// Create accessible label
const label = getAccessibilityLabel('Delete', 'dialog will open');
// → "Delete, dialog will open"

// Get proper role for React Native
const role = getAccessibilityRole('button');
// → 'button'
```

#### Keyboard Events
```typescript
import { handleKeyboardEvent } from '@/utils/a11y';

<input
  onKeyDown={(e) => handleKeyboardEvent(e, {
    onEscape: () => closeModal(),
    onEnter: () => submitForm(),
  })}
/>
```

### Hooks (hooks/useKeyboardNavigation.ts)

#### useAccessibilityAnnounce
```typescript
import { useAccessibilityAnnounce } from '@/hooks/useKeyboardNavigation';

const Component = () => {
  const { announcement, priority, announce } = useAccessibilityAnnounce();
  
  const handleLoad = () => {
    announce('Content loaded successfully', false); // polite
  };
  
  const handleError = () => {
    announce('Error loading content', true); // assertive
  };
  
  return (
    <>
      <AccessibilityAnnouncer message={announcement} priority={priority} />
      <button onClick={handleLoad}>Load</button>
    </>
  );
};
```

#### useReducedMotion
```typescript
import { useReducedMotion } from '@/hooks/useKeyboardNavigation';

const AnimatedComponent = () => {
  const { prefersReduced, duration } = useReducedMotion();
  
  return (
    <Animated.View
      style={{
        duration: duration, // 0ms if user prefers reduced motion
      }}
    >
      {children}
    </Animated.View>
  );
};
```

### Components

#### SkipToContentLink
```typescript
import SkipToContentLink from '@/components/accessibility/SkipToContentLink';

<SkipToContentLink 
  targetId="main-content" 
  label="Skip to main content" 
/>
<main id="main-content">...</main>
```

#### AccessibilityAnnouncer
```typescript
import AccessibilityAnnouncer from '@/components/accessibility/AccessibilityAnnouncer';

<AccessibilityAnnouncer 
  message="5 new items loaded" 
  priority="polite"
  id="announcer-region"
/>
```

---

## 🎯 Common Use Cases

### Make a Button Accessible
```tsx
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel="Save document"
  onPress={handleSave}
>
  <Text>Save</Text>
</TouchableOpacity>
```

### Make a Collapsible Section Accessible
```tsx
const [isOpen, setIsOpen] = useState(false);

<View>
  <TouchableOpacity
    onPress={() => setIsOpen(!isOpen)}
    accessibilityLabel={getAccessibilityLabel('Settings', `${isOpen ? 'Expanded' : 'Collapsed'}`)}
  >
    <Text>Settings</Text>
  </TouchableOpacity>
  
  {isOpen && (
    <View role="region" aria-label="Settings content">
      {/* content */}
    </View>
  )}
</View>
```

### Add Alt Text to Image
```tsx
<Image
  source={image}
  alt="Mountain landscape at sunset"
  accessible={true}
  accessibilityLabel="Mountain landscape at sunset"
/>
```

### Create a Live Region
```tsx
const { announcement, announce } = useAccessibilityAnnounce();

useEffect(() => {
  announce(`${items.length} items in cart`);
}, [items.length, announce]);

return (
  <>
    <AccessibilityAnnouncer message={announcement} />
    <View>{/* content */}</View>
  </>
);
```

---

## 🧪 Testing Accessibility

### Manual Testing Checklist
- [ ] Tab through all interactive elements
- [ ] Escape key closes modals/dropdowns
- [ ] Focus indicator is visible
- [ ] Focus order is logical
- [ ] All images have alt text
- [ ] All buttons have labels
- [ ] Color contrast is sufficient (use `isWCAG_AA()`)
- [ ] Animations respect `prefers-reduced-motion`

### Automated Testing
```bash
# Run accessibility tests
npm run test:run -- a11y.test.ts

# Lint for accessibility issues
npm run lint -- --fix

# Check with Lighthouse
npm run build:web && lighthouse https://localhost:3000 --view
```

---

## 🔗 Resources

### WCAG Guidelines
- [WCAG 2.1 Level AAA](https://www.w3.org/WAI/WCAG21/quickref/?currentsetting=level_aaa)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)
- [Screen Reader Testing](https://www.nvaccess.org/) (NVDA)

### React Native Accessibility
- [React Native Accessibility Guide](https://reactnative.dev/docs/accessibility)
- [Platform Specific Accessibility](https://reactnative.dev/docs/platform-specific-code)

---

## 💬 FAQ

**Q: What's the difference between WCAG AA and AAA?**  
A: AA requires 4.5:1 contrast ratio; AAA requires 7:1. AAA is more strict and better for low vision users.

**Q: Does React Native support ARIA?**  
A: Partially. Use `accessibilityRole` and `accessibilityLabel` instead of `role` and `aria-label`.

**Q: How do I test with a screen reader?**  
A: Use VoiceOver (Mac), Narrator (Windows), or NVDA (Windows, free). The test checklist above covers most scenarios.

**Q: What about dark mode?**  
A: Use `useReducedMotion()` for animations. Color contrast should still be checked against actual background color.

**Q: How often should I test?**  
A: Run `npm run test:run` with every change. Manual testing every sprint.

---

## 📞 Support

If you encounter issues:

1. **Check tests:** `npm run test:run -- a11y.test.ts`
2. **Read documentation:** `PHASE2_ACCESSIBILITY_COMPLETE.md`
3. **Review examples:** Look at comments in `utils/a11y.ts`
4. **Check implementation:** See `TravelDetailsContainer.tsx` for integration example

---

**Last Updated:** December 29, 2025  
**Status:** ✅ Ready to Use

