import { RouteRecordType } from ".";
import { HasBuilderLink } from "../BuilderLink/AttachableRoutesBuilder";
import { Location } from "../LocationComposer/Location";
import { assertString } from "../util/assert";
import { resolveLinkLocation } from "./resolveLinkLocation";
import { ActionTypeOfRouteRecord, RouteRecordBase } from "./RouteRecordBase";

/**
 * Special route definition for wildcard route.
 */
export type WildcardRouteRecordObject<
  ActionResult,
  Match,
  HasAction extends boolean
> = {
  matchKey: string;
  route: WildcardRouteRecord<ActionResult, Match, HasAction>;
};

/**
 * Object for wildcard route in RoutesBuilder.
 */
export class WildcardRouteRecord<ActionResult, Match, HasAction extends boolean>
  extends RouteRecordBase<ActionResult, Match, HasAction>
  implements RouteRecordType<ActionResult, Match, HasAction> {
  readonly matchKey: Extract<keyof Match, string>;
  #parent: HasBuilderLink<ActionResult, string>;
  constructor(
    parent: HasBuilderLink<ActionResult, string>,
    matchKey: Extract<keyof Match, string>,
    action: ActionTypeOfRouteRecord<ActionResult, Match, HasAction>
  ) {
    super(action);
    this.#parent = parent;
    this.matchKey = matchKey;
  }

  getLocation(match: Match): Location {
    const wildcardValue = match[this.matchKey];
    assertString(wildcardValue);

    const link = this.#parent.getBuilderLink();
    return resolveLinkLocation(link, match, (parentLocation) =>
      link.composer.compose(parentLocation, wildcardValue)
    );
  }
}
