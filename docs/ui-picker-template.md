# UI Picker Template

## Template Name

`picker-template-list-asset-light`

Use this when you want the white rounded searchable dropdown style shown in the maintenance/report filters.

## How To Call It

Apply both classes to the picker:

```tsx
<SearchableMultiSelectPicker
  className="report-campus-picker picker-template-list-asset-light"
/>
```

For single-select searchable pickers, use the same template class:

```tsx
<LocationPicker
  className="report-campus-picker picker-template-list-asset-light"
/>
```

## Best Context

Use inside a maintenance/report filter row, especially:

- `maintenance-filter-row`
- `report-campus-picker`

This template is already styled for that layout in `src/App.css`.

## Visual Style

Style direction:

- Light desktop picker
- White popup
- Rounded corners
- Soft blue border
- Clean search box
- Tall list rows

## Exact Measurements

Trigger button:

- Min height: `56px`
- Padding: `10px 18px`
- Border radius: `22px`
- Border: `1px solid #c9dbf2`
- Font size: `16px`
- Font weight: `500`
- Text color: `#223a5c`

Trigger background:

```css
linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 245, 255, 0.98))
```

Trigger shadow:

```css
inset 0 1px 0 rgba(255, 255, 255, 0.92),
0 8px 18px rgba(17, 33, 58, 0.08)
```

Popup menu:

- Min width: `100%`
- Width: `max-content`
- Max width: `min(92vw, 640px)`
- Padding: `16px`
- Border radius: `24px`
- Border: `1px solid #d6e2f3`
- Background: `#ffffff`
- Shadow: `0 18px 36px rgba(36, 52, 82, 0.16)`

Search box:

- Min height: `56px`
- Left padding: `54px`
- Right padding: `16px`
- Border radius: `18px`
- Border: `1px solid #cfe0f5`
- Font size: `15px`
- Font weight: `500`
- Text color: `#17304f`
- Placeholder color: `#6a7f9f`
- Search icon left: `18px`

Search background:

```css
linear-gradient(180deg, #ffffff, #f7fbff)
```

List container:

- Display: `grid`
- Gap: `12px`
- Max height: `360px`

Option row:

- Min height: `58px`
- Padding: `10px 14px`
- Border radius: `18px`
- Border: `1px solid #d6e2f3`
- Background: `#ffffff`
- Text color: `#1d3156`

Option label:

- Font size: `16px`
- Font weight: `700`
- Line height: `1.3`
- Text color: `#1c2f52`

Hover state:

- Background: `#f7fbff`
- Border color: `#cbdcf2`

Checked/active state:

- Background: `#ffffff`
- Border color: `#c6d7f1`
- Focus ring: `0 0 0 2px rgba(198, 215, 241, 0.35)`

Checkbox:

- Size: `18px x 18px`
- Accent color: `#2f7cf6`

## Source Of Truth

Main template rules:

- `src/App.css` around `picker-template-list-asset-light`

Base picker component:

- `src/App.tsx` in `SearchableMultiSelectPicker`
- `src/App.tsx` in `LocationPicker`

## Quick Reuse Note

If you want this exact style again, say:

`Use picker-template-list-asset-light`

If you want the same look in report filters, say:

`Use report-campus-picker picker-template-list-asset-light`
