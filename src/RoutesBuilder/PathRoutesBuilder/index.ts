import { BuilderLink, RouteRecordsBase } from "..";
import { PathLocationComposer } from "../../LocationComposer/PathLocationComposer";
import {
  RouteRecord,
  RouteRecordType,
  RoutesDefinitionToRouteRecords,
  WildcardInRouteRecords,
} from "../../RouteRecord";
import {
  WildcardRouteRecord,
  WildcardRouteRecordObject,
} from "../../RouteRecord/WildcardRouteRecord";
import { RouteResolver } from "../../RouteResolver";
import type { AttachableRoutesBuilder } from "../AttachableRoutesBuilder";
import type { BuilderLinkOptions } from "../BuilderLinkOptions";
import type {
  RouteDefinition,
  RoutesDefinition,
} from "../RoutesDefinitionObject";
import { wildcardRouteKey } from "../symbols";
import type {
  ActionTypeToWildcardFlag,
  WildcardFlagType,
} from "../WildcardFlagType";

export type PathRoutesBuilderOptions<ActionResult> = Omit<
  BuilderLinkOptions<ActionResult, string>,
  "composer"
>;

/**
 * Builder to define routes using pathname.
 */
export class PathRoutesBuilder<
  ActionResult,
  Defs extends RoutesDefinition<ActionResult>,
  WildcardFlag extends WildcardFlagType,
  Match
> implements AttachableRoutesBuilder<ActionResult, string> {
  static init<ActionResult, Match = {}>(
    options: Partial<PathRoutesBuilderOptions<ActionResult>> = {}
  ): PathRoutesBuilder<ActionResult, {}, "none", Match> {
    const op = {
      ...options,
      composer: new PathLocationComposer(),
    };
    const rawBuilder = BuilderLink.init<ActionResult, string>(op);
    return new PathRoutesBuilder(rawBuilder);
  }

  /**
   * Attach a newly created PathRouteBuilder to given route.
   */
  static attachTo<ActionResult, Match, HasAction extends boolean>(
    route: RouteRecordType<ActionResult, Match, HasAction>
  ): PathRoutesBuilder<ActionResult, {}, "none", Match> {
    return route.attach(PathRoutesBuilder.init());
  }

  readonly #rawBuilder: BuilderLink<ActionResult, string>;
  #routes: RouteRecordsBase<ActionResult> = Object.create(null);
  #wildcardRoute:
    | WildcardRouteRecordObject<ActionResult, Match, boolean>
    | undefined = undefined;

  private constructor(rawBuilder: BuilderLink<ActionResult, string>) {
    this.#rawBuilder = rawBuilder;
    rawBuilder.register(this);
  }

  routes<D extends RoutesDefinition<ActionResult>>(
    defs: D
  ): PathRoutesBuilder<
    ActionResult,
    Omit<Defs, keyof D> & D,
    WildcardFlag,
    Match
  > {
    this.#rawBuilder.checkInvalidation();

    const result = new PathRoutesBuilder<
      ActionResult,
      Omit<Defs, keyof D> & D,
      WildcardFlag,
      Match
    >(this.#rawBuilder.inherit());
    const routes = result.#routes;
    Object.assign(routes, this.#routes);
    for (const key of Object.getOwnPropertyNames(defs) as (keyof D &
      string)[]) {
      routes[key] = new RouteRecord(this, key, defs[key].action);
    }
    result.#wildcardRoute = this.#wildcardRoute;
    // this.#rawBuilder.inheritTo(result.#rawBuilder);
    return result;
  }

  any<
    Key extends string,
    RD extends RouteDefinition<
      ActionResult,
      Match &
        {
          [K in Key]: string;
        }
    >
  >(
    key: Key,
    routeDefinition: RD
  ): PathRoutesBuilder<
    ActionResult,
    Defs,
    ActionTypeToWildcardFlag<RD["action"]>,
    Match &
      {
        [K in Key]: string;
      }
  > {
    this.#rawBuilder.checkInvalidation();

    const result = new PathRoutesBuilder<
      ActionResult,
      Defs,
      undefined extends RD["action"] ? "noaction" : "hasaction",
      Match &
        {
          [K in Key]: string;
        }
    >(this.#rawBuilder.inherit());
    result.#routes = this.#routes;
    result.#wildcardRoute = {
      matchKey: key,
      route: new WildcardRouteRecord(
        this,
        // TypeScript requires this `as` but this should be true because Key extends string.
        key as Extract<Key, string>,
        routeDefinition.action
      ),
    };
    // this.#rawBuilder.inheritTo(result.#rawBuilder);
    return result;
  }

  getRoutes(): Readonly<
    RoutesDefinitionToRouteRecords<ActionResult, Defs, Match> &
      WildcardInRouteRecords<ActionResult, WildcardFlag, Match>
  > {
    this.#rawBuilder.checkInvalidation();
    const routes = (this.#routes as unknown) as RoutesDefinitionToRouteRecords<
      ActionResult,
      Defs,
      Match
    >;
    if (this.#wildcardRoute) {
      return {
        ...routes,
        [wildcardRouteKey]: this.#wildcardRoute,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return routes as any;
    }
  }

  getBuilderLink(): BuilderLink<ActionResult, string> {
    return this.#rawBuilder;
  }

  getResolver(): RouteResolver<ActionResult, string> {
    return this.#rawBuilder.getResolver((segment) => {
      const route = this.#routes[segment];
      if (route !== undefined) {
        return {
          type: "normal",
          route,
        };
      }
      const wildcardRoute = this.#wildcardRoute;
      if (wildcardRoute !== undefined) {
        return {
          type: "wildcard",
          route: wildcardRoute.route,
        };
      }
      return undefined;
    });
  }
}
