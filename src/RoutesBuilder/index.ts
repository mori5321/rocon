import type { LocationComposer } from "../LocationComposer";
import type { Location } from "../LocationComposer/Location";
import type { RouteRecordType } from "../RouteRecord";
import { RouteResolver, SegmentResolver } from "../RouteResolver";
import { assertNever } from "../util/assert";
import { PartiallyPartial } from "../util/types/PartiallyPartial";
import { AttachableRoutesBuilder } from "./AttachableRoutesBuilder";
import type { BuilderLinkOptions } from "./BuilderLinkOptions";
import { BuilderLinkState } from "./BuilderLinkState";
import { fillOptions } from "./fillOptions";

export type RouteRecordsBase<ActionResult> = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RouteRecordType<ActionResult, any, any>
>;

/**
 * Link between parent and child builders.
 */
export class BuilderLink<ActionResult, Segment>
  implements AttachableRoutesBuilder<ActionResult, Segment> {
  static init<ActionResult, Segment>(
    options: PartiallyPartial<BuilderLinkOptions<ActionResult, Segment>, "root">
  ): BuilderLink<ActionResult, Segment> {
    fillOptions(options);
    return new BuilderLink<ActionResult, Segment>(options);
  }

  #state: BuilderLinkState<ActionResult, Segment> = {
    state: "unattached",
  };
  /**
   * Registered child builder.
   */
  #childBuilder?: AttachableRoutesBuilder<ActionResult, Segment> = undefined;
  // TODO: want to remove this one
  readonly composer: LocationComposer<Segment>;
  #rootLocation: Location;

  private constructor(options: BuilderLinkOptions<ActionResult, Segment>) {
    this.composer = options.composer;
    this.#rootLocation = options.root;
  }

  /**
   * Attach this link to a parent.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachToParent(parentRoute: RouteRecordType<any, any, any>) {
    // TODO: recover this check
    // if (this.#state !== "unattached") {
    //   throw new Error("A builder cannot be attached more than once.");
    // }
    this.#state = {
      state: "attached",
      parentRoute,
    };
  }

  /**
   * Follow inheritance chain and run a function at the end.
   */
  private followInheritanceChain<Result>(
    callback: (link: BuilderLink<ActionResult, Segment>) => Result
  ): {
    result: Result;
    last: BuilderLink<ActionResult, Segment>;
  } {
    if (this.#state.state === "inherited") {
      const res = this.#state.inheritor.followInheritanceChain(callback);
      // short-cut optimization
      this.#state.inheritor = res.last;
      return res;
    } else {
      const result = callback(this);
      return {
        result,
        last: this,
      };
    }
  }

  checkInvalidation() {
    if (this.#state.state === "inherited") {
      throw new Error("This RoutesBuilder is already invalidated.");
    }
  }

  getParentRoute(): RouteRecordType<ActionResult, never, boolean> | undefined {
    return this.followInheritanceChain((link) => link.#state.parentRoute)
      .result;
  }

  getRootLocation() {
    return this.followInheritanceChain((link) => link.#rootLocation).result;
  }

  getBuilderLink(): this {
    return this;
  }

  /**
   * TODO: wanna deprecate in favor of inherit
   */
  clone(): BuilderLink<ActionResult, Segment> {
    const result = new BuilderLink<ActionResult, Segment>({
      composer: this.composer,
      root: this.#rootLocation,
    });
    result.#state = this.#state;
    result.#childBuilder = this.#childBuilder;
    return result;
  }

  /**
   * TODO: rethink
   */
  register(builder: AttachableRoutesBuilder<ActionResult, Segment>): void {
    this.#childBuilder = builder;
  }

  /**
   * Create a new BuilderLink which inherits current link.
   */
  inherit(): BuilderLink<ActionResult, Segment> {
    switch (this.#state.state) {
      case "unattached": {
        return this.clone();
      }
      case "attached": {
        const result = new BuilderLink<ActionResult, Segment>({
          composer: this.composer,
          root: this.#rootLocation,
        });

        this.#state.parentRoute.attach(result);

        this.#state = {
          state: "inherited",
          inheritor: result,
        };
        return result;
      }
      case "inherited": {
        throw new Error("Cannot inherit already invalidated link");
      }
    }
  }

  /**
   * Inherit internal information to a builder generated from this.
   * TODO: deprecate in favor of `inherit`
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inheritTo(target: BuilderLink<ActionResult, any>): void {
    switch (this.#state.state) {
      case "unattached": {
        break;
      }
      case "attached": {
        // inherit attachedness to child
        if (target.#childBuilder !== undefined) {
          // this.#parentRoute should always exist here but we use ?. here for ease
          this.#state.parentRoute.attach(target.#childBuilder);
        }
        this.#state = {
          state: "invalidated",
        };
        break;
      }
      case "invalidated": {
        this.checkInvalidation();
        break;
      }
      default: {
        assertNever(this.#state);
      }
    }
  }

  getResolver(
    resolveSegment: SegmentResolver<ActionResult, Segment>
  ): RouteResolver<ActionResult, Segment> {
    this.checkInvalidation();
    return new RouteResolver(this.composer, resolveSegment);
  }
}
