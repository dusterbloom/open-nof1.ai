# Shadcn UI Components Reference

**Last Updated**: 2025-11-02
**Framework**: shadcn/ui (Radix UI + Tailwind CSS v4)
**Version**: Latest

## Overview

This document covers the shadcn/ui components used in the Metrics Chart filter system. All components are built on Radix UI primitives with Tailwind CSS v4 styling, providing accessible, customizable, and themeable UI elements.

## Table of Contents

- [Component Overview](#component-overview)
- [Badge Component](#badge-component)
- [Checkbox Component](#checkbox-component)
- [Label Component](#label-component)
- [Switch Component](#switch-component)
- [Radio Group Component](#radio-group-component)
- [Integration Examples](#integration-examples)
- [Theming and Customization](#theming-and-customization)

## Component Overview

### Used in Metrics Chart

| Component | Purpose | Location | Radix Primitive |
|-----------|---------|----------|-----------------|
| Badge | Symbol filter chips | `components/ui/badge.tsx` | @radix-ui/react-slot |
| Checkbox | Trade type filters | `components/ui/checkbox.tsx` | @radix-ui/react-checkbox |
| Label | Filter labels | `components/ui/label.tsx` | @radix-ui/react-label |
| Switch | Display toggles | `components/ui/switch.tsx` | @radix-ui/react-switch |
| Radio Group | Profitability filter | `components/ui/radio-group.tsx` | @radix-ui/react-radio-group |

### Common Features

All components share these characteristics:

- **Accessibility**: ARIA attributes, keyboard navigation, screen reader support
- **Theming**: Use CSS variables for colors, work in light/dark modes
- **Customization**: Accept `className` prop for Tailwind overrides
- **TypeScript**: Full type safety with TypeScript interfaces
- **Disabled States**: Support disabled prop with appropriate styling
- **Focus Rings**: Visible focus indicators for keyboard navigation

## Badge Component

**File**: `components/ui/badge.tsx`
**Primitive**: `@radix-ui/react-slot`

### Purpose

Displays small, pill-shaped labels for categorization and status indicators. Used in the Metrics Chart for symbol filter chips.

### API

```typescript
interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  asChild?: boolean;
}
```

### Variants

#### Default
Primary brand color background with white text.

```tsx
<Badge variant="default">BTC</Badge>
```

#### Secondary
Subtle background for less prominent badges.

```tsx
<Badge variant="secondary">Secondary</Badge>
```

#### Destructive
Red background for errors or warnings.

```tsx
<Badge variant="destructive">Error</Badge>
```

#### Outline
Transparent background with border.

```tsx
<Badge variant="outline">Outline</Badge>
```

### Usage in Metrics Chart

**Symbol Filter Chips** (Note: Currently using custom button styling, not Badge component):

```tsx
{(["BTC", "ETH", "SOL", "BNB", "DOGE"] as TradeSymbol[]).map((symbol) => (
  <button
    key={symbol}
    onClick={() => toggleSymbol(symbol)}
    className={`px-2 py-1 text-xs rounded transition-colors ${
      selectedSymbols.has(symbol)
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    }`}
  >
    {symbol}
  </button>
))}
```

**Alternative with Badge**:

```tsx
{(["BTC", "ETH", "SOL", "BNB", "DOGE"] as TradeSymbol[]).map((symbol) => (
  <Badge
    key={symbol}
    variant={selectedSymbols.has(symbol) ? "default" : "outline"}
    className="cursor-pointer"
    onClick={() => toggleSymbol(symbol)}
  >
    {symbol}
  </Badge>
))}
```

### Styling

The badge uses class-variance-authority (CVA) for variant styling:

```typescript
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
```

### Key Features

- **Slot Support**: Can render as child component with `asChild` prop
- **SVG Icons**: Automatically sizes SVG children to 12px (`[&>svg]:size-3`)
- **Focus Ring**: 3px ring on keyboard focus
- **Invalid States**: Red border/ring for `aria-invalid`
- **Hover States**: Different hover effects for interactive badges

## Checkbox Component

**File**: `components/ui/checkbox.tsx`
**Primitive**: `@radix-ui/react-checkbox`

### Purpose

Binary toggle for selecting multiple options. Used in the Metrics Chart for trade type filters (Buy/Sell/Hold).

### API

```typescript
interface CheckboxProps extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  className?: string;
}
```

### Basic Usage

```tsx
import { Checkbox } from "@/components/ui/checkbox";

<Checkbox
  id="terms"
  checked={accepted}
  onCheckedChange={setAccepted}
/>
```

### Usage in Metrics Chart

**Trade Type Filters**:

```tsx
{(["Buy", "Sell", "Hold"] as TradeOperation[]).map((type) => (
  <div key={type} className="flex items-center space-x-2">
    <Checkbox
      id={`trade-type-${type}`}
      checked={tradeTypeFilter.has(type)}
      onCheckedChange={() => toggleTradeType(type)}
    />
    <Label htmlFor={`trade-type-${type}`} className="text-xs cursor-pointer">
      {type}
    </Label>
  </div>
))}
```

### States

- **Unchecked**: Empty box with border
- **Checked**: Box with checkmark icon
- **Indeterminate**: Box with dash (not used in current implementation)
- **Disabled**: Grayed out with 50% opacity

### Styling

```typescript
className={cn(
  "peer border-input dark:bg-input/30",
  "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
  "data-[state=checked]:border-primary",
  "focus-visible:border-ring focus-visible:ring-ring/50",
  "size-4 shrink-0 rounded-[4px] border shadow-xs",
  className
)}
```

### Key Features

- **Checkmark Icon**: Uses lucide-react CheckIcon
- **Keyboard Support**: Space/Enter to toggle
- **Form Integration**: Works with form libraries (React Hook Form, etc.)
- **Accessibility**: Proper ARIA attributes for screen readers
- **Theme Support**: Adapts to light/dark mode

### Integration with Label

Always pair with Label component for accessibility:

```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="item-1" />
  <Label htmlFor="item-1">Accept terms</Label>
</div>
```

This ensures:
- Clicking label toggles checkbox
- Screen readers announce label
- Larger click target for mobile

## Label Component

**File**: `components/ui/label.tsx`
**Primitive**: `@radix-ui/react-label`

### Purpose

Accessible labels for form inputs. Associates text with form controls for improved UX and accessibility.

### API

```typescript
interface LabelProps extends React.ComponentProps<typeof LabelPrimitive.Root> {
  className?: string;
}
```

### Basic Usage

```tsx
import { Label } from "@/components/ui/label";

<Label htmlFor="email">Email address</Label>
<input id="email" type="email" />
```

### Usage in Metrics Chart

**Section Headers**:

```tsx
<Label className="text-xs font-semibold">Symbols</Label>
```

**Checkbox Labels**:

```tsx
<Label htmlFor={`trade-type-${type}`} className="text-xs cursor-pointer">
  {type}
</Label>
```

**Switch Labels**:

```tsx
<Label htmlFor="show-positions" className="text-xs cursor-pointer">
  Position Lines
</Label>
```

### Styling

```typescript
className={cn(
  "flex items-center gap-2 text-sm leading-none font-medium select-none",
  "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
  className
)}
```

### Key Features

- **Click-through**: Clicking label activates associated control
- **Disabled Support**: Grays out when parent is disabled
- **Flex Layout**: Built-in flex for icons/badges
- **No Selection**: Text is not selectable (select-none)
- **Screen Reader**: Announces label when control receives focus

### Best Practices

1. **Always use htmlFor**: Connect label to control via ID
```tsx
<Label htmlFor="username">Username</Label>
<Input id="username" />
```

2. **Add cursor-pointer for clickable controls**:
```tsx
<Label htmlFor="agree" className="cursor-pointer">
  I agree to terms
</Label>
<Checkbox id="agree" />
```

3. **Use for non-input elements** when appropriate:
```tsx
<Label className="font-semibold">Filter Options</Label>
```

## Switch Component

**File**: `components/ui/switch.tsx`
**Primitive**: `@radix-ui/react-switch`

### Purpose

Toggle switch for binary on/off states. More visually prominent than checkboxes. Used in the Metrics Chart for display toggles.

### API

```typescript
interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  className?: string;
}
```

### Basic Usage

```tsx
import { Switch } from "@/components/ui/switch";

<Switch
  id="airplane-mode"
  checked={enabled}
  onCheckedChange={setEnabled}
/>
```

### Usage in Metrics Chart

**Display Toggles**:

```tsx
<div className="flex items-center space-x-2">
  <Switch
    id="show-positions"
    checked={showPositions}
    onCheckedChange={setShowPositions}
  />
  <Label htmlFor="show-positions" className="text-xs cursor-pointer">
    Position Lines
  </Label>
</div>

<div className="flex items-center space-x-2">
  <Switch
    id="show-trades"
    checked={showTrades}
    onCheckedChange={setShowTrades}
  />
  <Label htmlFor="show-trades" className="text-xs cursor-pointer">
    Trade Dots
  </Label>
</div>
```

### States

- **Unchecked**: Gray background, thumb on left
- **Checked**: Primary color background, thumb on right
- **Disabled**: Grayed out, cannot interact

### Styling

**Root**:
```typescript
className={cn(
  "peer",
  "data-[state=checked]:bg-primary",
  "data-[state=unchecked]:bg-input",
  "dark:data-[state=unchecked]:bg-input/80",
  "inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border",
  "focus-visible:ring-[3px]",
  className
)}
```

**Thumb**:
```typescript
className={cn(
  "bg-background",
  "dark:data-[state=unchecked]:bg-foreground",
  "dark:data-[state=checked]:bg-primary-foreground",
  "pointer-events-none block size-4 rounded-full ring-0 transition-transform",
  "data-[state=checked]:translate-x-[calc(100%-2px)]",
  "data-[state=unchecked]:translate-x-0"
)}
```

### Key Features

- **Smooth Animation**: CSS transitions for thumb movement
- **Keyboard Support**: Space/Enter to toggle
- **Focus Ring**: 3px ring on focus
- **Dark Mode**: Different colors for light/dark themes
- **Mobile Friendly**: Large enough touch target (32px wide)

### Switch vs Checkbox

**Use Switch when**:
- Immediate effect (no form submission needed)
- Binary on/off state
- User expects instant feedback

**Use Checkbox when**:
- Part of a form (submit to apply)
- Multiple selections from a list
- Traditional form UX expected

## Radio Group Component

**File**: `components/ui/radio-group.tsx`
**Primitive**: `@radix-ui/react-radio-group`

### Purpose

Mutually exclusive selection from a list of options. Only one option can be selected at a time. Used in the Metrics Chart for profitability filter (although currently implemented as buttons).

### API

```typescript
interface RadioGroupProps extends React.ComponentProps<typeof RadioGroupPrimitive.Root> {
  className?: string;
}

interface RadioGroupItemProps extends React.ComponentProps<typeof RadioGroupPrimitive.Item> {
  className?: string;
}
```

### Basic Usage

```tsx
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

<RadioGroup value={selected} onValueChange={setSelected}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="option1" />
    <Label htmlFor="option1">Option 1</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option2" id="option2" />
    <Label htmlFor="option2">Option 2</Label>
  </div>
</RadioGroup>
```

### Alternative Usage in Metrics Chart

**Current Implementation** (custom buttons):

```tsx
{(["all", "profitable", "losing"] as const).map((filter) => (
  <button
    key={filter}
    onClick={() => setProfitabilityFilter(filter)}
    className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
      profitabilityFilter === filter
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground hover:bg-muted/80"
    }`}
  >
    {filter}
  </button>
))}
```

**With RadioGroup**:

```tsx
<RadioGroup
  value={profitabilityFilter}
  onValueChange={(value) => setProfitabilityFilter(value as typeof profitabilityFilter)}
>
  {(["all", "profitable", "losing"] as const).map((filter) => (
    <div key={filter} className="flex items-center space-x-2">
      <RadioGroupItem value={filter} id={`profit-${filter}`} />
      <Label htmlFor={`profit-${filter}`} className="text-xs cursor-pointer capitalize">
        {filter}
      </Label>
    </div>
  ))}
</RadioGroup>
```

### States

- **Unselected**: Empty circle with border
- **Selected**: Circle with filled dot in center
- **Disabled**: Grayed out, cannot interact

### Styling

**RadioGroup** (container):
```typescript
className={cn("grid gap-3", className)}
```

**RadioGroupItem**:
```typescript
className={cn(
  "border-input text-primary",
  "focus-visible:border-ring focus-visible:ring-ring/50",
  "dark:bg-input/30",
  "aspect-square size-4 shrink-0 rounded-full border shadow-xs",
  "focus-visible:ring-[3px]",
  className
)}
```

### Key Features

- **Filled Indicator**: CircleIcon from lucide-react
- **Keyboard Navigation**: Arrow keys to navigate, Space/Enter to select
- **Controlled Component**: Value managed by parent
- **Form Integration**: Works with form libraries
- **Accessibility**: Proper radio group ARIA roles

### Radio Group vs Select

**Use Radio Group when**:
- 2-5 options
- All options should be visible
- Comparison needed

**Use Select when**:
- 6+ options
- Space is limited
- Options are familiar (countries, states, etc.)

## Integration Examples

### Complete Filter Panel

Combining all components for a comprehensive filter UI:

```tsx
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

function FilterPanel() {
  const [showPositions, setShowPositions] = useState(true);
  const [selectedSymbols, setSelectedSymbols] = useState(new Set(["BTC", "ETH"]));
  const [tradeTypes, setTradeTypes] = useState(new Set(["Buy", "Sell"]));

  return (
    <div className="p-4 border rounded-lg bg-muted/30">
      <div className="grid grid-cols-3 gap-4">
        {/* Display Toggles */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Display</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="positions"
              checked={showPositions}
              onCheckedChange={setShowPositions}
            />
            <Label htmlFor="positions" className="text-xs cursor-pointer">
              Position Lines
            </Label>
          </div>
        </div>

        {/* Symbol Badges */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Symbols</Label>
          <div className="flex gap-2">
            {["BTC", "ETH", "SOL"].map((symbol) => (
              <Badge
                key={symbol}
                variant={selectedSymbols.has(symbol) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  const newSet = new Set(selectedSymbols);
                  newSet.has(symbol) ? newSet.delete(symbol) : newSet.add(symbol);
                  setSelectedSymbols(newSet);
                }}
              >
                {symbol}
              </Badge>
            ))}
          </div>
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Trade Types</Label>
          {["Buy", "Sell", "Hold"].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={type}
                checked={tradeTypes.has(type)}
                onCheckedChange={() => {
                  const newSet = new Set(tradeTypes);
                  newSet.has(type) ? newSet.delete(type) : newSet.add(type);
                  setTradeTypes(newSet);
                }}
              />
              <Label htmlFor={type} className="text-xs cursor-pointer">
                {type}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Form with All Components

```tsx
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function TradeFilterForm() {
  const [formData, setFormData] = useState({
    showVisuals: true,
    symbols: new Set(["BTC"]),
    operations: new Set(["Buy"]),
    profitability: "all",
  });

  return (
    <form className="space-y-6">
      {/* Switch */}
      <div className="flex items-center justify-between">
        <Label htmlFor="visuals">Show Visual Overlays</Label>
        <Switch
          id="visuals"
          checked={formData.showVisuals}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, showVisuals: checked })
          }
        />
      </div>

      {/* Badges as filters */}
      <div className="space-y-2">
        <Label>Cryptocurrencies</Label>
        <div className="flex gap-2">
          {["BTC", "ETH", "SOL", "BNB"].map((symbol) => (
            <Badge
              key={symbol}
              variant={formData.symbols.has(symbol) ? "default" : "outline"}
              className="cursor-pointer"
            >
              {symbol}
            </Badge>
          ))}
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <Label>Operations</Label>
        {["Buy", "Sell", "Hold"].map((op) => (
          <div key={op} className="flex items-center space-x-2">
            <Checkbox id={op} checked={formData.operations.has(op)} />
            <Label htmlFor={op}>{op}</Label>
          </div>
        ))}
      </div>

      {/* Radio Group */}
      <div className="space-y-2">
        <Label>Profitability</Label>
        <RadioGroup value={formData.profitability}>
          {["all", "profitable", "losing"].map((filter) => (
            <div key={filter} className="flex items-center space-x-2">
              <RadioGroupItem value={filter} id={filter} />
              <Label htmlFor={filter} className="capitalize">
                {filter}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Button type="submit">Apply Filters</Button>
    </form>
  );
}
```

## Theming and Customization

### CSS Variables

All components use Tailwind CSS v4 variables for theming:

```css
:root {
  --primary: /* primary brand color */;
  --primary-foreground: /* text on primary */;
  --secondary: /* secondary color */;
  --muted: /* muted background */;
  --muted-foreground: /* muted text */;
  --destructive: /* error/danger color */;
  --border: /* border color */;
  --input: /* input background */;
  --ring: /* focus ring color */;
}
```

### Dark Mode

Components automatically adapt using Tailwind's `dark:` variant:

```tsx
// Switch thumb in dark mode
dark:data-[state=unchecked]:bg-foreground
dark:data-[state=checked]:bg-primary-foreground

// Checkbox in dark mode
dark:bg-input/30
```

### Custom Styling

Override with `className` prop:

```tsx
// Custom colored switch
<Switch className="data-[state=checked]:bg-green-500" />

// Large checkbox
<Checkbox className="size-6" />

// Bold label
<Label className="font-bold text-lg" />
```

### Variant Customization

Extend variants using CVA:

```typescript
// Add new badge variant
const badgeVariants = cva(
  "...",
  {
    variants: {
      variant: {
        default: "...",
        success: "bg-green-500 text-white",  // New variant
      },
    },
  }
);
```

## Accessibility Checklist

All components in this document follow these accessibility standards:

- ✅ Keyboard navigation (Tab, Space, Enter, Arrow keys)
- ✅ Focus indicators (visible rings on focus)
- ✅ ARIA attributes (roles, states, labels)
- ✅ Screen reader support (announced correctly)
- ✅ Label associations (htmlFor linking)
- ✅ Disabled states (grayed out, not focusable)
- ✅ Color contrast (WCAG AA compliant)
- ✅ Touch targets (minimum 24px for mobile)

## Related Documentation

- [Metrics Chart Component](../components/METRICS_CHART.md) - Usage in context
- [Radix UI Documentation](https://www.radix-ui.com/) - Primitive components
- [shadcn/ui Documentation](https://ui.shadcn.com/) - Component library
- [Tailwind CSS v4](https://tailwindcss.com/) - Utility framework

## Additional Resources

- **shadcn/ui CLI**: `bunx shadcn@latest add <component>` to add components
- **Customization Guide**: Edit `components/ui/*.tsx` to customize
- **Theme Generator**: Use shadcn/ui theme customizer for color schemes
- **Accessibility**: Radix UI primitives are built with accessibility first

## Version History

- **1.0.0** (2025-11-02): Initial documentation for metrics chart components
