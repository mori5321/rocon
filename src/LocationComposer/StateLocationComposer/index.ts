import { LocationComposer } from "..";
import { BaseState, Location } from "../Location";

export class StateLocationComposer<Key extends string, StateValue>
  implements LocationComposer<StateValue> {
  readonly key: Key;
  readonly validator: (value: unknown) => value is StateValue;
  constructor(key: Key, validator: (value: unknown) => value is StateValue) {
    this.key = key;
    this.validator = validator;
  }

  isLeaf(location: Readonly<Location>): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (location.state as any)?.[this.key] === undefined;
  }
  compose<S extends BaseState>(
    base: Readonly<Location<S>>,
    segment: StateValue
  ): Location<S> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newState = {
      ...base.state,
      [this.key]: segment,
    };

    return {
      ...base,
      state: newState,
    };
  }
  decompose<S extends BaseState>(
    location: Readonly<Location<S>>
  ): Array<[StateValue, Location<Omit<S, Key>>]> {
    const { state } = location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (state as any)?.[this.key];
    if (value === undefined || !this.validator(value)) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [this.key]: _, ...rest } = state;
    return [
      [
        value,
        {
          ...location,
          state: rest,
        },
      ],
    ];
  }
}