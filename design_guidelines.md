# Design Guidelines: Modern Login Screen

## Design Approach
**Reference-Based**: Drawing inspiration from contemporary authentication interfaces like Linear, Notion, and Stripe - emphasizing clarity, minimal friction, and professional polish. The design prioritizes user confidence through generous whitespace, clear visual hierarchy, and thoughtful micro-interactions.

## Layout System

### Container Structure
- Full viewport height layout with centered authentication card
- Card container: `max-w-md` (448px) centered horizontally
- Vertical centering using flexbox with `min-h-screen`
- Padding: `p-8` for card interior, `px-4` for mobile viewport edges
- Consistent spacing scale: 2, 4, 6, 8, 12, 16 units

### Grid & Spacing
- Single column form layout
- Form fields stacked vertically with `space-y-6` between major sections
- Input groups: `space-y-4` between fields
- Button section: `mt-8` separation from form inputs
- Footer links/actions: `mt-6` with lighter visual weight

## Typography Hierarchy

### Font System
**Primary**: Inter or DM Sans via Google Fonts CDN
- Excellent readability for form labels and inputs
- Professional, modern appearance

**Hierarchy**:
- Page Title/Logo: `text-2xl font-bold` (24px)
- Form Labels: `text-sm font-medium` (14px)
- Input Text: `text-base` (16px) - prevents mobile zoom
- Helper Text: `text-sm` (14px)
- Error Messages: `text-sm font-medium` (14px)
- Link Text: `text-sm` (14px)

## Component Specifications

### Authentication Card
- Subtle shadow elevation: `shadow-lg`
- Rounded corners: `rounded-2xl`
- Background: solid, clean surface
- Border: `border` with subtle treatment
- Responsive padding: `p-6 md:p-8`

### Logo/Branding Area
- Positioned at top of card: `mb-8`
- Center-aligned
- Logo size: `h-8` to `h-10`
- Brand name below logo (if using): `text-xl font-semibold mt-3`

### Form Inputs
**Text Fields (Email/Password)**:
- Height: `h-12` for comfortable tap targets
- Padding: `px-4`
- Border radius: `rounded-lg`
- Border width: `border-2` for clear definition
- Font size: `text-base` (prevents iOS zoom)
- Transition: `transition-all duration-200`

**Input States**:
- Default: subtle border
- Focus: prominent border, subtle shadow ring
- Error: distinct error state with red accent
- Disabled: reduced opacity

### Labels
- Positioned above inputs: `mb-2`
- Left-aligned with input field
- Font weight: `font-medium`
- Required indicators: inline asterisk or "(required)" suffix

### Validation & Error Messages
- Positioned directly below affected input: `mt-2`
- Icon + text pattern (use Heroicons for icons)
- Icons: `h-5 w-5` inline with text
- Message visibility: slide-in animation on error

### Primary Button (Submit)
- Full width: `w-full`
- Height: `h-12`
- Border radius: `rounded-lg`
- Font: `text-base font-semibold`
- Loading state: spinner icon (from Heroicons) + "Signing in..." text
- Disabled state: reduced opacity, cursor-not-allowed

**Button States**:
- Default: solid, bold appearance
- Hover: subtle transform `scale-[1.02]` + shadow increase
- Active: slight scale down `scale-[0.98]`
- Loading: spinner animation, prevent multiple clicks
- Disabled: visual feedback of inactive state

### Secondary Actions
**"Forgot Password?" Link**:
- Positioned below password field: `mt-2`
- Right-aligned: `text-right`
- Text style: `text-sm underline-offset-4`
- Hover: underline decoration

**"Don't have an account?" Section**:
- Bottom of card: `mt-6 pt-6 border-t`
- Centered text with inline link
- Pattern: "Don't have an account? [Sign up]"

### Checkbox (Remember Me)
- Positioned between password and submit button
- Custom styled checkbox: `h-4 w-4 rounded`
- Label: `text-sm` with `ml-2` spacing
- Entire row: `flex items-center`

### Password Toggle
- Eye icon button positioned absolute right in password field
- Icon size: `h-5 w-5`
- Padding: `p-2` for 44px tap target
- Toggle between eye and eye-slash icons (Heroicons)

## Icons
**Icon Library**: Heroicons (outline style) via CDN
- Email icon: envelope icon for email field
- Password icon: lock-closed icon  
- Error icon: exclamation-circle for validation
- Success icon: check-circle for confirmations
- Eye icons: eye/eye-slash for password visibility
- Loading spinner: custom spinner or Heroicons arrow-path with spin animation

## Animation Specifications
**Minimal, Purposeful Motion**:
- Input focus: border and shadow transition `duration-200`
- Button hover: scale and shadow `duration-150`
- Error messages: slide-down entrance `duration-200`
- Loading spinner: continuous rotation
- Form submission: button state changes

**NO** elaborate page transitions or decorative animations

## Accessibility Features
- All inputs have associated labels (explicit for/id connection)
- ARIA labels for icon-only buttons
- Focus visible states for keyboard navigation
- Error messages linked to inputs via aria-describedby
- Proper heading hierarchy (h1 for page title)
- Form validation announcements for screen readers
- 44px minimum touch targets for mobile
- Sufficient contrast ratios throughout

## Responsive Behavior
**Mobile (< 768px)**:
- Card takes full width with side padding: `mx-4`
- Slightly reduced padding: `p-6`
- Stack all elements vertically
- Font sizes remain 16px+ to prevent zoom

**Desktop (≥ 768px)**:
- Centered card with max-width constraint
- Increased padding: `p-8`
- More generous vertical spacing

## Layout Notes
- Background: Full viewport with subtle treatment (optional pattern or gradient)
- Single card focus - no distracting elements
- Clear visual path: Logo → Title → Form → Button → Links
- Whitespace is a feature, not empty space
- Professional, trustworthy appearance