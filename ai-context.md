# Project context

## Mandatory application of the context

* Before modifying code, read this entire document and turn its applicable rules into concrete checks for the requested scope
* Before closing a change or review, systematically check its entire scope against these rules and correct every violation found
* Do not state that a file, change, or project complies with this context without having performed proportionate checks and validations
* If a rule cannot be applied because of a contract, technical limitation, or explicit decision, report the exception and its reason before closing the work
* Do not expand the scope or change unrequested contracts or behavior; if an additional change is necessary, identify it and request confirmation before applying it

## Code conventions

* Use descriptive and consistent names
* Prioritize readability over complexity and simple solutions over premature optimization
* Keep methods small whenever reasonable; extract repeated logic only when it provides real value
* Avoid duplication, unnecessary layers, helpers, and abstractions
* Maintain the project's compact style; keep code inline when it fits on one line and remains readable
* Do not write inline `if` statements; always use a block with braces
* Allow simple `if/else` statements when they clearly express two paths; avoid `else if` chains, nested trees, and complex flow. Prefer early returns, independent conditions, or `continue`; use `switch` when it represents several discrete cases more clearly
* If more code continues in the same block after an `if` block, add a blank line
* Declare each variable with its own `const` or `let`; do not group multiple declarations in one statement
* Name constants and static class properties in uppercase with words separated by underscores, including reusable regular expressions
* Declare module constants at the beginning of the file, after imports and before any class or function. Separate imports and constants with a blank line, and separate semantic groups from each other
* Keep constants and destructuring in the narrowest possible scope. Global or potentially global constants, including environment variables, belong in configuration; constants that only belong to a class must be private static properties of that class
* Declare a schema regular expression inline when it is used only once; make it a local constant only when it is reused within the same schema
* Do not add unnecessary line breaks or split strings and expressions solely for style when they remain readable and do not clearly exceed the horizontal limit
* Do not add comments to explain obvious code
* In simple callbacks, keep `it` when destructuring would not be useful; when the full object does not need to be retained, destructure the used properties. If it is retained, use a descriptive name
* Do not create intermediate variables solely to satisfy lint rules when direct destructuring with `let` is clearer
* When importing an object-type constant, access its property directly when it is used only once; destructure when two or more properties are used or when the same property is used more than once
* Group the consumed properties of the same constant in a single destructuring expression, including nested destructuring when appropriate
* Prefer the property's original name when destructuring; use a descriptive alias only when it avoids genuine confusion
* Do not add unreachable returns solely to satisfy lint after a call that throws when TypeScript already controls that flow correctly
* Static methods and properties that may be extracted through destructuring must reference other static members through the class name, never through `this`, to preserve their context
* Keep module helpers in the module while they do not need to be exported; turn external helpers used exclusively by a class into private methods of that class, unless that breaks a contract or creates a technical conflict
* Keep helpers that belong exclusively to a class's responsibility as private methods within that class
* Order class members as public properties, private properties, constructor, public methods, getters and setters, and private methods. Separate properties from the constructor with a blank line
* Declare dependencies as explicit properties and assign them in the constructor; do not use parameter properties
* Prefix intentionally unawaited asynchronous calls with `void`
* Preserve typed arrays and structures in mappings when other components need to filter them; convert them to text only in the final presentation layer
* Keep static styles in `src/styles`; only leave dynamically computed values in components
* Place every component with its own file in `src/components`, whether it is shared or route-specific; keep route files as minimal adapters only when the router requires them
* Inject instantiable dependencies that share state or configuration, such as API clients, storage, and authentication managers
* When an abstraction has a dedicated folder, place its implementations in `impl`

## Typing, contracts, and generics

* Type parameters whenever possible and use the most specific available type that respects the complete contract
* Typing and JSDoc must reflect the complete contract received by a function or method, not only the properties used internally
* When receiving an object with an existing contract, preserve and reference its complete type; do not replace it with a partial type, reduced inline object, or the type of a locally used property
* Explicitly type the value of every `useState`, even when TypeScript can infer it, so every state exposes a clear contract
* Every component must receive its parameters through a single `props` object; do not destructure directly in the signature
* Destructure `props` inside the component when it receives more than one property or when a single property is used more than once; if it receives one property used once, access it through `props.name`
* Every component that receives `children` must type its props with `PropsWithChildren`, whether it only receives `children` or extends its own contract
* Services, facades, and methods in other layers whose contract may grow must receive a single object parameter
* Prefer named interfaces or types for reusable, public, or complex contracts; use inline types only for simple local contracts
* Use generics only when they express a reusable relationship between types; avoid generic types when a more precise alternative exists
* Interfaces define public contracts: they do not contain `private` or `protected` members, and their properties must be `readonly` when consumers should only read them
* Plain objects, interfaces, types, and configuration may expose properties directly; preserve the names and types of the public contract

## Encapsulation and property access

* Declare internal class state as `private` by default; use `protected` only when a child class needs to extend it
* Omit `public`, explicitly declare `private` and `protected` where appropriate, and use ECMAScript `#` fields only when runtime privacy is also required
* Avoid exposing internal state through public fields and keep its control in the responsible class
* Expose encapsulated properties through getters only when needed, and create setters only when external modification is allowed
* Prefer TypeScript native `get` and `set` accessors for simple access; use specific methods when a change represents a business operation or has side effects
* Do not mechanically create getters and setters; read-only properties must not have a setter
* DTOs defined as classes must follow these same rules without changing their contract, mutability, or serialization; use an appropriate serialization mechanism when necessary
* Do not replace public contracts with getters or setters only for aesthetics; review syntax, enumerability, mutability, and runtime compatibility
* Child classes must use existing getters, setters, or methods when they provide controlled access; use `protected` only when inheritance justifies it

## JSDoc and documentation

* Document base types such as `ApiResponse` and `ApiErrorResponse`, interfaces reused throughout the application, and types whose purpose is not obvious
* Do not document CRUD DTOs, such as `LoginRequest`, `UserResponse`, or `UpdateDeviceRequest`, nor interfaces whose name clearly explains their role
* Do not document `params` as an intermediate object; document `params.id`, `params.data`, and other properties directly
* Do not add `@returns` when a function does not explicitly return anything
* Do not add JSDoc to React components
* Maintain documentation consistency throughout the project

### Classes

* All public classes must be documented with a brief, direct description without a trailing period

```js
/**
 * Devices manager
 *
 * @author HattoriHanzo-Ronin
 */
```

### Public methods

* Document public methods with short descriptions focused on their responsibility
* Use `Returns`, `Creates`, `Updates`, `Deletes`, or `Inserts` as appropriate, without overexplaining internal behavior

```js
/**
 * Returns a device by its identifier
 *
 * @param {string} params.id Device identifier
 * @returns {Promise<Object>} Device
 */
```

### Private methods

* Document private methods only when their name does not explain the behavior, they contain relevant logic, perform complex transformations, or are not immediately obvious
* Do not document obvious private helpers

## Testing

* Keep tests outside `src`, within `tests`
* Replicate the tested code structure under `tests`; for example, `src/utils` corresponds to `tests/utils`
* Test behavior, not implementations; avoid duplicate tests and prioritize cases that provide real value
* Keep tests compact, inline when readable, and without unnecessary blank lines

## Design decisions

* Prioritize clarity over micro-optimizations
* When several valid solutions exist, choose the simplest one consistent with the existing architecture
* Do not mix responsibilities; respect the existing architecture and placement of each responsibility before creating new files
* Do not rethink the architecture unless there is a real problem
* Preserve existing public contracts whenever possible and avoid refactorings that add complexity without genuinely improving the architecture

## Expected way of working

* Do not create commits unless the user explicitly requests them
* When commits are requested, separate dependency updates, implementation, tests, and documentation according to their responsibility
* Strictly limit changes to the requested scope; do not modify, fix, or refactor files or code the user did not ask to touch
* If refactoring is requested, generate the refactored code directly
* Do not respond with plans when the result can be delivered
* Do not propose alternatives unless there is a real decision to make
* If context is missing, request all necessary context at once
* If something cannot be done, say so clearly and immediately
* Maintain decisions already made in the project
* Every excluded file or directory must remain excluded, whether or not it is listed in `.gitignore`; do not add, track, commit, remove, or reveal it
