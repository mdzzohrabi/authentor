import { GraphQLScalarType, ValueNode } from 'graphql';
export let AnyScalarType = new GraphQLScalarType({

    name: "Any",
    description: "Any Type",

    parseValue: value => {
        return value;
    },

    serialize: value => {
        return value;
    },

    parseLiteral: (ast, vars) => {
        return parseLiteral(ast, vars);
    }

});

export let KeyValuePairScalarType = new GraphQLScalarType({

    name: "KeyValuePair",
    description: "Key Value Pair",

    parseValue: value => {
        return value;
    },

    serialize: value => {
        return value;
    },

    parseLiteral: (ast, vars) => {
        if (ast.kind != 'ObjectValue') {
            throw TypeError("Invalid Key Value Pair");
        }
        return parseLiteral(ast, vars);
    }

});

export function parseLiteral(ast: ValueNode, vars: { [key: string]: any }) {
    switch (ast.kind) {
        case 'BooleanValue': return !!ast.value;
        case 'FloatValue': return parseFloat(ast.value);
        case 'IntValue': return parseInt(ast.value);
        case 'NullValue': return null;
        case 'StringValue': return ast.value;
        case 'ListValue': return ast.values.map(value => {
            return parseLiteral(value, vars);
        });
        case 'Variable': return vars[ast.name.value];
        case "EnumValue":      
            if (ast.value == 'undefined') return undefined;
            return null;
        case 'ObjectValue': 
            let result = {};
            ast.fields.forEach(field => {
                result[ field.name.value ] = parseLiteral( field.value, vars );
            });
            return result;
    }

    return null;
}