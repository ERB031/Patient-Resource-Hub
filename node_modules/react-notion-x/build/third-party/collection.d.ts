import * as react_jsx_runtime from 'react/jsx-runtime';
import * as types from 'notion-types';
import { N as NotionContext } from '../context--HOSgWjH.js';
import React__default from 'react';

interface IPropertyProps {
    propertyId?: string;
    schema?: types.CollectionPropertySchema;
    data?: types.Decoration[];
    block?: types.Block;
    collection?: types.Collection;
    inline?: boolean;
    linkToTitlePage?: boolean;
    pageHeader?: boolean;
}
declare function PropertyImpl(props: IPropertyProps): react_jsx_runtime.JSX.Element | null;
declare const PropertyImplMemo: React__default.MemoExoticComponent<typeof PropertyImpl>;

declare function Collection({ block, className, ctx }: {
    block: types.CollectionViewBlock | types.CollectionViewPageBlock | types.PageBlock;
    className?: string;
    ctx: NotionContext;
}): react_jsx_runtime.JSX.Element | null;

export { Collection, PropertyImplMemo as Property };
