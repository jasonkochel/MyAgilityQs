- ✅ Make auth persistent - when the token expires I am getting logged out
- ✅ Run the local Vite dev server on a different port so it doesn't conflict with other projects I have
- ✅ Consider loading all dog data for the user upon login, using Tanstack Query to cache it so it's available on all pages immediately. This is especially helpful for the View Runs page where you need to load the dogs to look up the IDs and get the names
- ✅ Add the ability to hard-delete a dog
- ✅ Add the ability to hard-delete a run (from the View Runs page)
- ✅ Use the icon from the main menu as the favicon too
- ✅ Do not show inactive dogs on Add Run
- ✅ On Add Run, have the placement buttons reflect the colors of the ribbons: 1st = Blue, 2nd = Red, 3rd = Yellow, 4th = White, None = gray
- ✅ "Location" is missing from the screens, including the "pick from prior locations in my data" feature
- ✅ When adding a run, just show the class; we already know the level for each class; show the level in small text inside the class button to make it obvious, but don't make the user select it
- ✅ Add logic to auto-change the level of the dog upon saving a Q. Per-class, you need 3 Novice Qs to move into Open, 3 Open Qs to move into Excellent, and 3 Excellent Qs to move into Masters. Then you stay in Masters forever.
- Add a profile option for whether you want to track "NQ" runs or not. If not, don't show the Q/NQ buttons or filters; just assume everything is "Q"
- There is code generated for "progress" but I'm not sure what it is intended to be
- Add "Log In With Google", still via Cognito

## ✅ COMPLETED: Auto-Level Progression & Code Quality Improvements

### Auto-Level Progression System

- ✅ **Server-side logic**: Dogs automatically advance levels after 3 qualifying runs
- ✅ **AKC compliance**: Novice → Open → Excellent → Masters progression
- ✅ **Class-specific**: Each class progresses independently
- ✅ **User notifications**: Trophy celebrations when dogs advance levels
- ✅ **Cache invalidation**: My Dogs page updates immediately without refresh
- ✅ **Error handling**: Robust error handling prevents run creation failures

### Shared Type System Cleanup

- ✅ **Eliminated duplication**: Removed duplicate types between client and server
- ✅ **Centralized types**: All core types now in `@my-agility-qs/shared` package
- ✅ **Type safety**: Strict enums for CompetitionClass and CompetitionLevel
- ✅ **Clean separation**: Client now only contains UI-specific types
- ✅ **Improved maintainability**: Single source of truth for all data types

### Hard Delete Functionality

- ✅ **Server endpoints**: Both soft delete (PUT with active: false) and hard delete (DELETE) implemented
- ✅ **RESTful routing**: Proper HTTP methods for different delete operations
- ✅ **UI confirmation**: Mantine confirmModal with destructive action styling
- ✅ **User safety**: Clear warnings about permanent deletion
- ✅ **Data integrity**: Hard delete removes all associated data
- ✅ **UX polish**: Immediate cache invalidation and success notifications
