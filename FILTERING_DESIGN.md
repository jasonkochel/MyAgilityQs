# View Runs: Progress-Focused Organization Design Proposal

## Overview
Enhance the View Runs page to focus on what agility competitors actually need: tracking progress toward next levels/titles and viewing Qs organized by class/level rather than just chronologically.

## Current State
- Filter by Dog (button grid)
- Show only Qs toggle (when not in trackQsOnly mode)
- Basic sorting by Date, Dog, Class, Level
- Chronological list view only

## Proposed Design

### 1. **Two View Modes**

#### **List View (Default - Current behavior)**
- Keep current chronological list
- Enhanced with responsive columns (already implemented)

#### **Progress View (New)**
- Focus on current level progress and title advancement
- Organized by class/level with progress indicators

### 2. **Progress View Layout**

#### **Per-Dog Progress Cards**
```
┌─ Bella ──────────────────────────────────────────────────┐
│ ▼ Standard - Masters (12 Q runs) → MACH Progress        │
│   ████████░░ 8/20 Double Qs  |  ██████░░░░ 650/750 pts │
│   Recent Qs: 2024-12-15, 2024-12-10, 2024-12-08...     │
│                                                          │
│ ▼ Standard - Excellent (15 Q runs) → Masters (3 needed) │
│   ██████████████████░░ 12/15 Qs                         │
│   Recent Qs: 2024-12-14, 2024-12-12, 2024-12-05...     │
│                                                          │
│ ▼ Jumpers - Masters (8 Q runs) → MACH Progress          │
│   ████████░░ 8/20 Double Qs  |  ██████░░░░ 650/750 pts │
│   Recent Qs: 2024-12-15, 2024-12-09, 2024-12-03...     │
└──────────────────────────────────────────────────────────┘
```

#### **Expandable Class/Level Sections**
Each section expands to show:
- All qualifying runs in that class/level
- Progress toward next milestone
- Recent run details (placement, time, location)

### 3. **Key Features**

#### **Progress Indicators**
- **Level Advancement**: Visual progress bars showing X/15 Qs toward next level
- **MACH Progress**: Dual progress bars for Double Qs and MACH points
- **Title Tracking**: Clear indication of progress toward MX, MXJ, MACH, MACH2, etc.

#### **Organized Q Display**
```
▼ Standard - Excellent (12/15 Qs toward Masters)
  ████████████████████░░░░░ 80% complete
  
  2024-12-15  1st Place  45.23s  Westminster
  2024-12-12  2nd Place  46.81s  Westminster  
  2024-12-08  4th Place  47.92s  Dog Show Express
  2024-12-05  1st Place  44.15s  Westminster
  ... [show more] ...
```

#### **Smart Grouping**
- Group by current competing level (where dog needs Qs)
- Highlight "active" classes where dog is currently competing
- Show completed levels with summary stats

### 4. **UI Implementation**

#### **View Toggle**
```
┌─ View Runs ──────────────────────────────┐
│ [List View] [Progress View] 📊           │
│                                          │
│ Filter by Dog: [All] [Bella] [Max]       │
└──────────────────────────────────────────┘
```

#### **Progress View Filters**
- Dog selection (same as current)
- Class filter: Show/hide specific classes
- Focus mode: "Show only active levels" (where dog needs Qs)

#### **Mobile Optimization**
- Stack progress cards vertically
- Collapsible sections to save space
- Swipe to expand run details

### 5. **Technical Implementation**

#### **Data Structure**
```typescript
interface ProgressViewData {
  dogId: string;
  dogName: string;
  classes: {
    className: CompetitionClass;
    currentLevel: CompetitionLevel;
    runs: Run[];
    progressToNext: {
      type: 'level' | 'mach' | 'title';
      current: number;
      needed: number;
      description: string; // "3 more Qs for Masters"
    };
    machProgress?: {
      doubleQs: { current: number; needed: number };
      machPoints: { current: number; needed: number };
      completeMachs: number;
    };
  }[];
}
```

#### **Progress Calculations**
- Reuse existing shared progress calculation utilities
- Add new utilities for level advancement tracking
- Real-time updates when runs are added/edited

#### **Responsive Design**
- Desktop: Side-by-side cards for multiple dogs
- Tablet: Stacked cards with horizontal progress bars
- Mobile: Single column with collapsible sections

### 6. **User Experience**

#### **Quick Access to Key Info**
- See at a glance: "3 more Standard Qs needed for Masters"
- Track MACH progress without manual calculation
- Identify which classes need attention

#### **Drill-Down Capability**
- Click progress bar → see all runs in that class/level
- Click run → open existing RunDetailsModal
- Maintain all current editing capabilities

#### **Progress Motivation**
- Visual progress bars provide motivation
- Clear milestone tracking
- Celebration of achievements (MACH badges, level completions)

### 7. **Integration with Existing Features**

#### **Maintains Current Functionality**
- All existing filtering and sorting in List View
- RunDetailsModal for editing runs
- Responsive columns (already implemented)

#### **Enhances Title Progress Page**
- Complements existing Title Progress with detailed run viewing
- Cross-navigation between Progress View and Title Progress
- Consistent progress calculation logic

This design addresses the core needs: tracking progress toward advancement and viewing Qs in an organized, meaningful way that helps agility competitors understand their training priorities and achievements.