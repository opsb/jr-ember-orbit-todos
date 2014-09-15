(function(global) {
var define = global.Orbit.__defineModule__;
var requireModule = global.Orbit.__requireModule__;
define("orbit-common", 
  ["orbit-common/main","orbit-common/cache","orbit-common/schema","orbit-common/serializer","orbit-common/source","orbit-common/memory-source","orbit-common/lib/exceptions","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __exports__) {
    "use strict";
    var OC = __dependency1__["default"];
    var Cache = __dependency2__["default"];
    var Schema = __dependency3__["default"];
    var Serializer = __dependency4__["default"];
    var Source = __dependency5__["default"];
    var MemorySource = __dependency6__["default"];
    var OperationNotAllowed = __dependency7__.OperationNotAllowed;
    var RecordNotFoundException = __dependency7__.RecordNotFoundException;
    var LinkNotFoundException = __dependency7__.LinkNotFoundException;
    var RecordAlreadyExistsException = __dependency7__.RecordAlreadyExistsException;

    OC.Cache = Cache;
    OC.Schema = Schema;
    OC.Serializer = Serializer;
    OC.Source = Source;
    OC.MemorySource = MemorySource;
    // exceptions
    OC.OperationNotAllowed = OperationNotAllowed;
    OC.RecordNotFoundException = RecordNotFoundException;
    OC.LinkNotFoundException = LinkNotFoundException;
    OC.RecordAlreadyExistsException = RecordAlreadyExistsException;

    __exports__["default"] = OC;
  });
define("orbit-common/cache", 
  ["orbit/document","orbit/evented","orbit/lib/objects","./lib/exceptions","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var Document = __dependency1__["default"];
    var Evented = __dependency2__["default"];
    var Class = __dependency3__.Class;
    var expose = __dependency3__.expose;
    var isArray = __dependency3__.isArray;
    var OperationNotAllowed = __dependency4__.OperationNotAllowed;

    /**
     `Cache` provides a thin wrapper over an internally maintained instance of a
     `Document`.

     `Cache` prepares records to be cached according to a specified schema. The
     schema also determines the paths at which records will be stored.

     Once cached, data can be accessed at a particular path with `retrieve`. The
     size of data at a path can be accessed with `length`.

     @class Cache
     @namespace OC
     @param {OC.Schema} schema
     @param {Object}  [options]
     @param {Boolean} [options.trackChanges=true] Should the `didTransform` event be triggered after calls to `transform`?
     @param {Boolean} [options.trackRevLinks=true] Should `__rev` be maintained for each record, indicating which other records reference them?
     @param {Boolean} [options.trackRevLinkChanges=false] Should the `didTransform` event be triggered after `__rev` is updated?
     @constructor
     */
    var Cache = Class.extend({
      init: function(schema, options) {
        options = options || {};
        this.trackChanges = options.trackChanges !== undefined ? options.trackChanges : true;
        this.trackRevLinks = options.trackRevLinks !== undefined ? options.trackRevLinks : true;
        this.trackRevLinkChanges = options.trackRevLinkChanges !== undefined ? options.trackRevLinkChanges : false;

        this._doc = new Document(null, {arrayBasedPaths: true});

        Evented.extend(this);

        this.schema = schema;
        for (var model in schema.models) {
          if (schema.models.hasOwnProperty(model)) {
            this._registerModel(model);
          }
        }

        // TODO - clean up listener
        this.schema.on('modelRegistered', this._registerModel, this);
      },

      _registerModel: function(model) {
        var modelRootPath = [model];
        if (!this.retrieve(modelRootPath)) {
          this._doc.add(modelRootPath, {});
        }
      },

      reset: function(data) {
        this._doc.reset(data);
        this.schema.registerAllKeys(data);
      },

      /**
       Return the size of data at a particular path

       @method length
       @param path
       @returns {Number}
       */
      length: function(path) {
        var data = this.retrieve(path);
        if (data === null) {
          return null;
        } else if (isArray(data)) {
          return data.length;
        } else {
          return Object.keys(data).length;
        }
      },

      /**
       Return data at a particular path.

       Returns `null` if the path does not exist in the document.

       @method retrieve
       @param path
       @returns {Object}
       */
      retrieve: function(path) {
        try {
          return this._doc.retrieve(path);
        } catch(e) {
          return null;
        }
      },

      /**
       Transforms the document with an RFC 6902-compliant operation.

       Currently limited to `add`, `remove` and `replace` operations.

       Throws `PathNotFoundException` if the path does not exist in the document.

       @method transform
       @param {Object} operation
       @param {String} operation.op Must be "add", "remove", or "replace"
       @param {Array or String} operation.path Path to target location
       @param {Object} operation.value Value to set. Required for "add" and "replace"
       */
      transform: function(operation) {
        var op = operation.op,
            path = operation.path;

        path = this._doc.deserializePath(path);

        if (op !== 'add' && op !== 'remove' && op !== 'replace') {
          throw new OperationNotAllowed('Cache#transform requires an "add", "remove" or "replace" operation.');
        }

        if (path.length < 2) {
          throw new OperationNotAllowed('Cache#transform requires an operation with a path >= 2 segments.');
        }

        if (this.trackRevLinks && (op === 'remove' || op === 'replace')) {
          this._removeRevLinks(path);
        }

        this._transform(operation, this.trackChanges);

        if (this.trackRevLinks && (op === 'add' || op === 'replace')) {
          this._addRevLinks(path, operation.value);
        }
      },

      _transform: function(operation, track) {
    //    console.log('_transform', operation, track);
        if (track) {
          var inverse = this._doc.transform(operation, true);
          this.emit('didTransform', operation, inverse);

        } else {
          this._doc.transform(operation, false);
        }
      },

      _addRevLinks: function(path, value) {
    //    console.log('_addRevLinks', path, value);
        if (value) {
          var _this = this,
              type = path[0],
              id = path[1],
              linkSchema,
              linkValue;

          if (path.length === 2) {
            // when a whole record is added, add inverse links for every link
            if (value.__rel) {
              Object.keys(value.__rel).forEach(function(link) {
                linkSchema = _this.schema.models[type].links[link];
                linkValue = value.__rel[link];

                if (linkSchema.type === 'hasMany') {
                  Object.keys(linkValue).forEach(function(v) {
                    _this._addRevLink(linkSchema, type, id, link, v);
                  });

                } else {
                  _this._addRevLink(linkSchema, type, id, link, linkValue);
                }
              });
            }

          } else if (path.length > 3) {
            var link = path[3];

            linkSchema = _this.schema.models[type].links[link];

            if (path.length === 5) {
              linkValue = path[4];
            } else {
              linkValue = value;
            }

            this._addRevLink(linkSchema, type, id, link, linkValue);
          }
        }
      },

      _addRevLink: function(linkSchema, type, id, link, value) {
    //    console.log('_addRevLink', linkSchema, type, id, link, value);

        if (value && typeof value === 'string') {
          var linkPath = [type, id, '__rel', link];
          if (linkSchema.type === 'hasMany') {
            linkPath.push(value);
          }
          linkPath = '/' + linkPath.join('/');

          var refsPath = [linkSchema.model, value, '__rev'];
          var refs = this.retrieve(refsPath);
          if (!refs) {
            refs = {};
            refs[linkPath] = true;
            this._transformRef('add', refsPath, refs);

          } else {
            refsPath.push(linkPath);
            refs = this.retrieve(refsPath);
            if (!refs) {
              this._transformRef('add', refsPath, true);
            }
          }
        }
      },

      _removeRevLinks: function(path) {
    //    console.log('_removeRevLinks', path);

        var value = this.retrieve(path);
        if (value) {
          var _this = this,
              type = path[0],
              id = path[1],
              linkSchema,
              linkValue;

          if (path.length === 2) {
            // when a whole record is removed, remove any links that reference it
            if (value.__rev) {
    //          console.log('removeRefs from deleted record', type, id, value.__rev);

              var operation;
              Object.keys(value.__rev).forEach(function(path) {
                path = _this._doc.deserializePath(path);

                if (path.length === 4) {
                  operation = {
                    op: 'replace',
                    path: path,
                    value: null
                  };
                } else {
                  operation = {
                    op: 'remove',
                    path: path
                  };
                }

                try {
                  _this._transform(operation, _this.trackChanges);
                } catch(e) {
                  console.log('Cache._transform() exception:', e, 'operation:', operation);
                }
              });
            }

            // when a whole record is removed, remove references corresponding to each link
            if (value.__rel) {
              Object.keys(value.__rel).forEach(function(link) {
                linkSchema = _this.schema.models[type].links[link];
                linkValue = value.__rel[link];

                if (linkSchema.type === 'hasMany') {
                  Object.keys(linkValue).forEach(function(v) {
                    _this._removeRevLink(linkSchema, type, id, link, v);
                  });

                } else {
                  _this._removeRevLink(linkSchema, type, id, link, linkValue);
                }
              });
            }

          } else if (path.length > 3) {
            var link = path[3];

            linkSchema = _this.schema.models[type].links[link];

            if (path.length === 5) {
              linkValue = path[4];
            } else {
              linkValue = value;
            }

            this._removeRevLink(linkSchema, type, id, link, linkValue);
          }
        }
      },

      _removeRevLink: function(linkSchema, type, id, link, value) {
    //    console.log('_removeRevLink', linkSchema, type, id, link, value);

        if (value && typeof value === 'string') {
          var linkPath = [type, id, '__rel', link];
          if (linkSchema.type === 'hasMany') {
            linkPath.push(value);
          }
          linkPath = '/' + linkPath.join('/');

          var revLinkPath = [linkSchema.model, value, '__rev', linkPath];
          this._transformRef('remove', revLinkPath);
        }
      },

      _transformRef: function(op, path, value) {
        var operation = {
          op: op,
          path: path
        };
        if (value) {
          operation.value = value;
        }
        try {
          this._transform(operation, this.trackRevLinkChanges);
        } catch(e) {
          // TODO - verbose logging of transform exceptions
          // console.log('Cache._transformRef() exception', e, 'for operation', operation);
        }
      }
    });

    __exports__["default"] = Cache;
  });
define("orbit-common/lib/exceptions", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
     @module orbit-common
     */

    /**
     Exception thrown when an operation is not allowed.

     @class OperationNotAllowed
     @namespace OC
     @param {Object} description
     @constructor
     */
    var OperationNotAllowed = function(description) {
      this.description = description;
    };

    OperationNotAllowed.prototype = {
      constructor: OperationNotAllowed
    };

    /**
     Exception thrown when a record can not be found.

     @class RecordNotFoundException
     @namespace OC
     @param {String} type
     @param {Object} record
     @constructor
     */
    var RecordNotFoundException = function(type, record) {
      this.type = type;
      this.record = record;
    };

    RecordNotFoundException.prototype = {
      constructor: RecordNotFoundException
    };

    /**
     Exception thrown when a record can not be found.

     @class LinkNotFoundException
     @namespace OC
     @param {String} type
     @param {Object} record
     @constructor
     */
    var LinkNotFoundException = function(type, record, key) {
      this.type = type;
      this.record = record;
      this.key = key;
    };

    LinkNotFoundException.prototype = {
      constructor: LinkNotFoundException
    };

    /**
     Exception thrown when a record already exists.

     @class RecordAlreadyExistsException
     @namespace OC
     @param {String} type
     @param {Object} record
     @constructor
     */
    var RecordAlreadyExistsException = function(type, record) {
      this.type = type;
      this.record = record;
    };

    RecordAlreadyExistsException.prototype = {
      constructor: RecordAlreadyExistsException
    };

    __exports__.OperationNotAllowed = OperationNotAllowed;
    __exports__.RecordNotFoundException = RecordNotFoundException;
    __exports__.LinkNotFoundException = LinkNotFoundException;
    __exports__.RecordAlreadyExistsException = RecordAlreadyExistsException;
  });
define("orbit-common/main", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
     The Orbit Common library (namespaced `OC` by default) defines a common set of
     compatible sources.

     The Common library contains a base abstract class, `Source`, which supports
     both `Transformable` and `Requestable` interfaces. The method signatures on
     `Source` should be supported by other sources that want to be fully compatible
     with the Common library.

     @module orbit-common
     @main orbit-common
     */

    /**
     Namespace for Orbit Common methods and classes.

     @class OC
     @static
     */
    var OC = {};

    __exports__["default"] = OC;
  });
define("orbit-common/memory-source", 
  ["orbit/main","orbit/lib/assert","orbit/lib/objects","./source","./lib/exceptions","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var Orbit = __dependency1__["default"];
    var assert = __dependency2__.assert;
    var isArray = __dependency3__.isArray;
    var isNone = __dependency3__.isNone;
    var Source = __dependency4__["default"];
    var RecordNotFoundException = __dependency5__.RecordNotFoundException;
    var LinkNotFoundException = __dependency5__.LinkNotFoundException;

    /**
     Source for storing in-memory data

     @class MemorySource
     @namespace OC
     @extends OC.Source
     @param schema
     @param options
     @constructor
     */
    var MemorySource = Source.extend({
      init: function(schema, options) {
        assert('MemorySource requires Orbit.Promise to be defined', Orbit.Promise);
        this._super.apply(this, arguments);
      },

      /////////////////////////////////////////////////////////////////////////////
      // Transformable interface implementation
      /////////////////////////////////////////////////////////////////////////////

      _transform: function(operation) {
        this._transformRelatedInverseLinks(operation);
        this._cache.transform(operation);
      },

      /////////////////////////////////////////////////////////////////////////////
      // Requestable interface implementation
      /////////////////////////////////////////////////////////////////////////////

      _find: function(type, id) {
        var _this = this,
            modelSchema = this.schema.models[type],
            pk = modelSchema.primaryKey.name,
            result;

        return new Orbit.Promise(function(resolve, reject) {
          if (isNone(id)) {
            result = _this._filter.call(_this, type);

          } else if (isArray(id)) {
            var res,
                resId,
                notFound;

            result = [];
            notFound = [];

            for (var i = 0, l = id.length; i < l; i++) {
              resId = id[i];

              res = _this.retrieve([type, resId]);

              if (res) {
                result.push(res);
              } else {
                notFound.push(resId);
              }
            }

            if (notFound.length > 0) {
              result = null;
              id = notFound;
            }

          } else if (id !== null && typeof id === 'object') {
            if (id[pk]) {
              result = _this.retrieve([type, id[pk]]);

            } else {
              result = _this._filter.call(_this, type, id);
            }

          } else {
            result = _this.retrieve([type, id]);
          }

          if (result) {
            resolve(result);
          } else {
            reject(new RecordNotFoundException(type, id));
          }
        });
      },

      _findLink: function(type, id, link) {
        var _this = this;

        return new Orbit.Promise(function(resolve, reject) {
          id = _this.getId(type, id);

          var record = _this.retrieve([type, id]);

          if (record) {
            var relId;

            if (record.__rel) {
              relId = record.__rel[link];

              if (relId) {
                var linkDef = _this.schema.models[type].links[link];
                if (linkDef.type === 'hasMany') {
                  relId = Object.keys(relId);
                }
              }
            }

            if (relId) {
              resolve(relId);

            } else {
              reject(new LinkNotFoundException(type, id, link));
            }

          } else {
            reject(new RecordNotFoundException(type, id));
          }
        });
      },

      /////////////////////////////////////////////////////////////////////////////
      // Internals
      /////////////////////////////////////////////////////////////////////////////

      _transformRelatedInverseLinks: function(operation) {
        var _this = this;
        var path = operation.path;
        var type = path[0];
        var record;
        var key;
        var linkDef;
        var linkValue;
        var inverseLinkOp;

        if (operation.op === 'add') {
          if (path.length > 3 && path[2] === '__rel') {

            key = path[3];
            linkDef = this.schema.models[type].links[key];

            if (linkDef.inverse) {
              _this._transformAddLink(
                linkDef.model,
                linkDef.type === 'hasMany' ? path[4] : operation.value,
                linkDef.inverse,
                path[1]
              );
            }

          } else if (path.length === 2) {

            record = operation.value;
            if (record.__rel) {
              Object.keys(record.__rel).forEach(function(key) {
                linkDef = _this.schema.models[type].links[key];

                if (linkDef.inverse) {
                  if (linkDef.type === 'hasMany') {
                    Object.keys(record.__rel[key]).forEach(function(id) {
                      _this._transformAddLink(
                        linkDef.model,
                        id,
                        linkDef.inverse,
                        path[1]
                      );
                    });

                  } else {
                    var id = record.__rel[key];

                    if (!isNone(id)) {
                      _this._transformAddLink(
                        linkDef.model,
                        id,
                        linkDef.inverse,
                        path[1]
                      );
                    }
                  }
                }
              });
            }
          }

        } else if (operation.op === 'remove') {

          if (path.length > 3 && path[2] === '__rel') {

            key = path[3];
            linkDef = this.schema.models[type].links[key];

            if (linkDef.inverse) {
              var relId;
              if (linkDef.type === 'hasMany') {
                relId = path[4];
              } else {
                relId = this.retrieve(path);
              }

              if (relId) {
                _this._transformRemoveLink(
                  linkDef.model,
                  relId,
                  linkDef.inverse,
                  path[1]
                );
              }
            }

          } else if (path.length === 2) {

            record = this.retrieve(path);
            if (record.__rel) {
              Object.keys(record.__rel).forEach(function(key) {
                linkDef = _this.schema.models[type].links[key];

                if (linkDef.inverse) {
                  if (linkDef.type === 'hasMany') {
                    Object.keys(record.__rel[key]).forEach(function(id) {
                      _this._transformRemoveLink(
                        linkDef.model,
                        id,
                        linkDef.inverse,
                        path[1]
                      );
                    });

                  } else {
                    var id = record.__rel[key];

                    if (!isNone(id)) {
                      _this._transformRemoveLink(
                        linkDef.model,
                        id,
                        linkDef.inverse,
                        path[1]
                      );
                    }
                  }
                }
              });
            }
          }
        }
      },

      _transformAddLink: function(type, id, key, value) {
        if (this._cache.retrieve([type, id])) {
          this._cache.transform(this._addLinkOp(type, id, key, value));
        }
      },

      _transformRemoveLink: function(type, id, key, value) {
        var op = this._removeLinkOp(type, id, key, value);
        if (this._cache.retrieve(op.path)) {
          this._cache.transform(op);
        }
      },

      _filter: function(type, query) {
        var all = [],
            dataForType,
            i,
            prop,
            match,
            record;

        dataForType = this.retrieve([type]);

        for (i in dataForType) {
          if (dataForType.hasOwnProperty(i)) {
            record = dataForType[i];
            if (query === undefined) {
              match = true;
            } else {
              match = false;
              for (prop in query) {
                if (record[prop] === query[prop]) {
                  match = true;
                } else {
                  match = false;
                  break;
                }
              }
            }
            if (match) all.push(record);
          }
        }
        return all;
      },

      _filterOne: function(type, prop, value) {
        var dataForType,
            i,
            record;

        dataForType = this.retrieve([type]);

        for (i in dataForType) {
          if (dataForType.hasOwnProperty(i)) {
            record = dataForType[i];
            if (record[prop] === value) {
              return record;
            }
          }
        }
      }
    });

    __exports__["default"] = MemorySource;
  });
define("orbit-common/schema", 
  ["orbit/lib/objects","orbit/lib/uuid","./lib/exceptions","orbit/evented","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var Class = __dependency1__.Class;
    var clone = __dependency1__.clone;
    var extend = __dependency1__.extend;
    var uuid = __dependency2__.uuid;
    var OperationNotAllowed = __dependency3__.OperationNotAllowed;
    var Evented = __dependency4__["default"];

    /**
     `Schema` defines the models allowed in a source, including their keys,
     attributes and relationships. A single schema may be shared across multiple
     sources.

     Schemas are defined with an initial set of options, passed in as a constructor
     argument:

     ``` javascript
      var schema = new Schema({
        models: {
          planet: {
            attributes: {
              name: {type: 'string'},
              classification: {type: 'string'}
            },
            links: {
              moons: {type: 'hasMany', model: 'moon', inverse: 'planet'}
            }
          },
          moon: {
            attributes: {
              name: {type: 'string'}
            },
            links: {
              planet: {type: 'hasOne', model: 'planet', inverse: 'moons'}
            }
          }
        }
      });
     ```

     Models should be keyed by their singular name, and should be defined as an
     object that contains `attributes` and/or `links`.

     Models can be registered after a schema's been initialized with
     `registerModel`.

     ## Fields

     There are three broad categories of fields available for models: keys,
     attributes, and links.

     Within each category, fields may be declared along with options appropriate
     for the category. Common field options include:

     * `type` - a classification, often category-specific, that defines a field's
       purpose and/or contents.

     * `defaultValue` - a value or function that returns a value, to be set on
       record initialization when a field's value is `undefined`.

     Default fields for models can be specified in a `modelDefaults` object. A
     single primary key field, `id`, is defined by default (see below).

     ### Keys

     Keys uniquely identify a record of a particular model type.

     Keys may only be of type `"string"`, which is also the default and therefore 
     unnecessary to declare.

     Every model must define a single "primary key", which will be used throughout
     Orbit to identify records of that type uniquely. This should be indicated with
     the field option `primaryKey: true`.

     By default, `modelDefaults` define a primary key `id` to be used for all
     models:

     ```
      {
        keys: {
          'id': {primaryKey: true, defaultValue: uuid}
        }
      }
     ```

     The default primary key has a v4 UUID generator assigned as its `defaultValue`.
     Because of this, these keys can be used within Orbit and on remote servers with
     an extremely low probability of a conflict.

     When working with remote servers that do not support UUID primary keys, it's
     necessary to correlate Orbit IDs with IDs that are generated remotely. In order
     to support this scenario, one or more "secondary keys" may also be defined for
     a model.

     Let's say that you want to track Orbit's primary key locally as a UUID named
     `__id` and also define a remote key named `id`. You could define `modelDefaults`
     in your schema as follows:

     ```
      var schema = new Schema({
        modelDefaults: {
          keys: {
            '__id': {primaryKey: true, defaultValue: uuid},
            'id': {}
          }
        }
      });
     ```

     The `id` field above is considered a secondary key because `primaryKey` is
     `false` by default.

     When any secondary keys are defined, the schema will maintain a mapping of
     secondary to primary key values that can be shared by all sources. This
     centralized mapping assumes that key values will never change once set, which
     is a realistic assumption for distributed systems.

     ### Attributes

     Any properties that define a model's data, with the exception of links to other
     models, should be defined as "attributes".

     Attributes may be defined by their `type`, such as `"string"` or `"date"`,
     which can be used to define their purpose and contents. An attribute's type may
     also be used to determine how it should be normalized and serialized.

     ### Links

     Links are properties that define relationships between models. Two types of links
     are currently allowed:

     * `hasOne` - for one-to-one relationships
     * `hasMany` - for one-to-many relationships

     Links must define the related `model` and may optionally define their
     `inverse`, which should correspond to the name of a link on the related model.
     Inverse links should be defined when links must be kept synchronized, so that
     adding or removing a link on the primary model results in a corresponding
     change on the inverse model.

     Here's an example of a schema definition that includes links with inverses:

     ```
      var schema = new Schema({
        models: {
          planet: {
            links: {
              moons: {type: 'hasMany', model: 'moon', inverse: 'planet'}
            }
          },
          moon: {
            links: {
              planet: {type: 'hasOne', model: 'planet', inverse: 'moons'}
            }
          }
        }
      });
     ```

     ## Model Defaults

     The `modelDefaults` object defines a default model schema for ALL models in the
     schema. This is useful for defining the default ID attribute and any other
     attributes or links that are present across models in the schema.

     As discussed above, `modelDefaults` defines a single primary key by default.
     `modelDefaults` can be overridden to include any number of attributes and links.
     For instance:

     ```
      var schema = new Schema({
        modelDefaults: {
          keys: {
            __id: {primaryKey: true, defaultValue: uuid}
          },
          attributes: {
            createdAt: {type: 'date', defaultValue: currentTime}
          }
        }
      });
     ```
     
     The default fields can be overridden in or removed from any particular model
     definition. To remove any key, attribute or link definition inherited from
     `modelDefaults` simply define the field with a falsey value (`undefined`,
     `null`, or `false`).

     For example, the following schema removes `createdAt` from the `planet` model:

     ```
      var schema = new Schema({
        modelDefaults: {
          keys: {
            __id: {primaryKey: true, defaultValue: uuid}
          },
          attributes: {
            createdAt: {type: 'date', defaultValue: currentTime}
          }
        },
        models: {
          planet: {
            attributes: {
              name: {type: 'string'},
              createdAt: undefined
            }
          }
        }
      });
     ```
     
     @class Schema
     @namespace OC
     @param {Object}   [options]
     @param {Object}   [options.modelDefaults] defaults for model schemas
     @param {Function} [options.pluralize] Function used to pluralize names
     @param {Function} [options.singularize] Function used to singularize names
     @param {Object}   [options.models] schemas for individual models supported by this schema
     @constructor
     */
    var Schema = Class.extend({
      init: function(options) {
        options = options || {};
        // model defaults
        if (options.modelDefaults) {
          this.modelDefaults = options.modelDefaults;
        } else {
          this.modelDefaults = {
            keys: {
              'id': {primaryKey: true, defaultValue: uuid}
            }
          };
        }
        // inflection
        if (options.pluralize) {
          this.pluralize = options.pluralize;
        }
        if (options.singularize) {
          this.singularize = options.singularize;
        }

        Evented.extend(this);

        // register provided model schema
        this.models = {};
        if (options.models) {
          for (var model in options.models) {
            if (options.models.hasOwnProperty(model)) {
              this.registerModel(model, options.models[model]);
            }
          }
        }
      },

      registerModel: function(model, definition) {
        var modelSchema = this._mergeModelSchemas({}, this.modelDefaults, definition);

        // process key definitions
        for (var name in modelSchema.keys) {
          var key = modelSchema.keys[name];

          key.name = name;
          
          if (key.primaryKey) {
            if (modelSchema.primaryKey) {
              throw new OperationNotAllowed('Schema can only define one primaryKey per model');
            }
            modelSchema.primaryKey = key;
          
          } else {
            key.primaryKey = false;

            key.secondaryToPrimaryKeyMap = {};
            key.primaryToSecondaryKeyMap = {};

            modelSchema.secondaryKeys = modelSchema.secondaryKeys || {};
            modelSchema.secondaryKeys[name] = key;
          }

          key.type = key.type || 'string';
          if (key.type !== 'string') {
            throw new OperationNotAllowed('Model keys must be of type `"string"`');
          }
        }

        // ensure every model has a valid primary key
        if (!modelSchema.primaryKey || typeof modelSchema.primaryKey.defaultValue !== 'function') {
          throw new OperationNotAllowed('Model schema ID defaultValue must be a function');
        }

        this.models[model] = modelSchema;

        this.emit('modelRegistered', model);
      },

      normalize: function(model, data) {
        if (data.__normalized) return data;

        var record = data; // TODO? clone(data);

        // set flag
        record.__normalized = true;

        // init backward links
        record.__rev = record.__rev || {};

        // init forward links
        record.__rel = record.__rel || {};

        // init meta info
        record.__meta = record.__meta || {};

        this.initDefaults(model, record);

        return record;
      },

      initDefaults: function(model, record) {
        if (!record.__normalized) {
          throw new OperationNotAllowed('Schema.initDefaults requires a normalized record');
        }

        var modelSchema = this.models[model],
            keys = modelSchema.keys,
            attributes = modelSchema.attributes,
            links = modelSchema.links;

        // init primary key - potentially setting the primary key from secondary keys if necessary
        this._initPrimaryKey(modelSchema, record);

        // init default key values
        for (var key in keys) {
          if (record[key] === undefined) {
            record[key] = this._defaultValue(record, keys[key].defaultValue, null);
          }
        }

        // init default attribute values
        if (attributes) {
          for (var attribute in attributes) {
            if (record[attribute] === undefined) {
              record[attribute] = this._defaultValue(record, attributes[attribute].defaultValue, null);
            }
          }
        }

        // init default link values
        if (links) {
          for (var link in links) {
            if (record.__rel[link] === undefined) {
              record.__rel[link] = this._defaultValue(record, 
                                                      links[link].defaultValue,
                                                      links[link].type === 'hasMany' ? {} : null);
            }
          }
        }

        this._mapKeys(modelSchema, record);
      },

      primaryToSecondaryKey: function(model, secondaryKeyName, primaryKeyValue, autoGenerate) {
        var modelSchema = this.models[model];
        var secondaryKey = modelSchema.keys[secondaryKeyName];

        var value = secondaryKey.primaryToSecondaryKeyMap[primaryKeyValue];

        // auto-generate secondary key if necessary, requested, and possible
        if (value === undefined && autoGenerate && secondaryKey.defaultValue) {
          value = secondaryKey.defaultValue();
          this._registerKeyMapping(secondaryKey, primaryKeyValue, value);
        }

        return value;
      },

      secondaryToPrimaryKey: function(model, secondaryKeyName, secondaryKeyValue, autoGenerate) {
        var modelSchema = this.models[model];
        var secondaryKey = modelSchema.keys[secondaryKeyName];

        var value = secondaryKey.secondaryToPrimaryKeyMap[secondaryKeyValue];

        // auto-generate primary key if necessary, requested, and possible
        if (value === undefined && autoGenerate && modelSchema.primaryKey.defaultValue) {
          value = modelSchema.primaryKey.defaultValue();
          this._registerKeyMapping(secondaryKey, value, secondaryKeyValue);
        }

        return value;
      },

      // TODO - test
      registerAllKeys: function(data) {
        if (data) {
          Object.keys(data).forEach(function(type) {
            var modelSchema = this.models[type];

            if (modelSchema && modelSchema.secondaryKeys) {
              var records = data[type];

              records.forEach(function(record) {
                var id = record[modelSchema.primaryKey.name],
                    altId;

                Object.keys(modelSchema.secondaryKeys).forEach(function(secondaryKey) {
                  altId = record[secondaryKey];
                  if (altId !== undefined && altId !== null) {
                    var secondaryKeyDef = modelSchema.secondaryKeys[secondaryKey];
                    this._registerKeyMapping(secondaryKeyDef, id, altId);
                  }
                }, this);
              }, this);
            }
          }, this);
        }
      },

      pluralize: function(word) {
        return word + 's';
      },

      singularize: function(word) {
        if (word.lastIndexOf('s') === word.length - 1) {
          return word.substr(0, word.length - 1);
        } else {
          return word;
        }
      },

      _defaultValue: function(record, value, defaultValue) {
        if (value === undefined) {
          return defaultValue;

        } else if (typeof value === 'function') {
          return value.call(record);

        } else {
          return value;
        }
      },

      _initPrimaryKey: function(modelSchema, record) {
        var pk = modelSchema.primaryKey.name;
        var id = record[pk];

        // init primary key from secondary keys
        if (!id && modelSchema.secondaryKeys) {
          var keyNames = Object.keys(modelSchema.secondaryKeys);
          for (var i=0, l = keyNames.length; i <l ; i++){
            var key = modelSchema.keys[keyNames[i]];
            var value = record[key.name];
            if (value) {
              id = key.secondaryToPrimaryKeyMap[value];
              if (id) {
                record[pk] = id;
                return;
              }
            }
          }
        }
      },

      _mapKeys: function(modelSchema, record) {
        var id = record[modelSchema.primaryKey.name];

        if (modelSchema.secondaryKeys) {
          Object.keys(modelSchema.secondaryKeys).forEach(function(name) {
            var value = record[name];
            if (value) {
              var key = modelSchema.secondaryKeys[name];
              this._registerKeyMapping(key, id, value);
            }
          }, this);
        }
      },

      _registerKeyMapping: function(secondaryKeyDef, primaryValue, secondaryValue) {
        secondaryKeyDef.primaryToSecondaryKeyMap[primaryValue] = secondaryValue;
        secondaryKeyDef.secondaryToPrimaryKeyMap[secondaryValue] = primaryValue;
      },

      _mergeModelSchemas: function(base) {
        var sources = Array.prototype.slice.call(arguments, 1);

        // ensure model schema has categories set
        base.keys = base.keys || {};
        base.attributes = base.attributes || {};
        base.links = base.links || {};

        sources.forEach(function(source) {
          source = clone(source);
          this._mergeModelFields(base.keys, source.keys);
          this._mergeModelFields(base.attributes, source.attributes);
          this._mergeModelFields(base.links, source.links);
        }, this);

        return base;
      },

      _mergeModelFields: function(base, source) {
        if (source) {
          Object.keys(source).forEach(function(field) {
            if (source.hasOwnProperty(field)) {
              var fieldDef = source[field];
              if (fieldDef) {
                base[field] = fieldDef;
              } else {
                // fields defined as falsey should be removed
                delete base[field];
              }
            }
          });
        }
      }
    });

    __exports__["default"] = Schema;
  });
define("orbit-common/serializer", 
  ["orbit/lib/objects","orbit/lib/stubs","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var Class = __dependency1__.Class;
    var required = __dependency2__.required;

    var Serializer = Class.extend({
      init: function(schema) {
        this.schema = schema;
      },

      serialize: required,

      deserialize: required
    });

    __exports__["default"] = Serializer;
  });
define("orbit-common/source", 
  ["orbit/main","orbit/document","orbit/transformable","orbit/requestable","orbit/lib/assert","orbit/lib/stubs","orbit/lib/objects","./cache","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __dependency8__, __exports__) {
    "use strict";
    var Orbit = __dependency1__["default"];
    var Document = __dependency2__["default"];
    var Transformable = __dependency3__["default"];
    var Requestable = __dependency4__["default"];
    var assert = __dependency5__.assert;
    var required = __dependency6__.required;
    var Class = __dependency7__.Class;
    var expose = __dependency7__.expose;
    var isNone = __dependency7__.isNone;
    var Cache = __dependency8__["default"];

    /**
     `Source` is an abstract base class to be extended by other sources.

     @class Source
     @namespace OC
     @param {OC.Schema} schema
     @param options
     @constructor
    */
    var Source = Class.extend({
      init: function(schema, options) {
        assert("Source's `schema` must be specified", schema);

        this.schema = schema;

        options = options || {};

        // Create an internal cache and expose some elements of its interface
        this._cache = new Cache(schema);
        expose(this, this._cache, 'length', 'reset', 'retrieve');
        // TODO - clean up listener
        this._cache.on('didTransform', this._cacheDidTransform, this);

        Transformable.extend(this);
        Requestable.extend(this, ['find', 'add', 'update', 'patch', 'remove',
                                  'findLink', 'addLink', 'removeLink',
                                  'findLinked']);
      },

      /////////////////////////////////////////////////////////////////////////////
      // Transformable interface implementation
      /////////////////////////////////////////////////////////////////////////////

      /**
       Internal method that applies a single transform to this source.

       `_transform` must be implemented by a `Transformable` source.
       It is called by the public method `transform` in order to actually apply
       transforms.

       `_transform` should return a promise if the operation is asynchronous.

       @method _transform
       @param operation JSON PATCH operation as detailed in RFC 6902
       @private
       */
      _transform: required,

      /////////////////////////////////////////////////////////////////////////////
      // Requestable interface implementation
      /////////////////////////////////////////////////////////////////////////////

      _find: required,

      _findLink: required,

      _findLinked: function(type, id, link, relId) {
        var _this = this;
        var linkDef = _this.schema.models[type].links[link];
        var relType = linkDef.model;

        id = this.getId(type, id);

        if (relId === undefined) {
          relId = this.retrieveLink(type, id, link);
        }

        if (this._isLinkEmpty(linkDef.type, relId)) {
          return new Orbit.Promise(function(resolve) {
            resolve(relId);
          });

        } else if (relId) {
          return this.find(relType, relId);

        } else {
          return this.findLink(type, id, link).then(function(relId) {
            if (_this._isLinkEmpty(linkDef.type, relId)) {
              return relId;
            } else {
              return _this.find(relType, relId);
            }
          });
        }
      },

      _add: function(type, data) {
        data = data || {};

        var record = this.normalize(type, data);

        var id = this.getId(type, record),
            path = [type, id],
            _this = this;

        return this.transform({op: 'add', path: path, value: record}).then(function() {
          return _this.retrieve(path);
        });
      },

      _update: function(type, data) {
        var record = this.normalize(type, data);
        var id = this.getId(type, record);
        var path = [type, id];

        return this.transform({op: 'replace', path: path, value: record});
      },

      _patch: function(type, id, property, value) {
        if (id !== null && typeof id === 'object') {
          var record = this.normalize(type, id);
          id = this.getId(type, record);
        }

        var path = [type, id].concat(Document.prototype.deserializePath(property));

        return this.transform({op: 'replace', path: path, value: value});
      },

      _remove: function(type, id) {
        if (id !== null && typeof id === 'object') {
          var record = this.normalize(type, id);
          id = this.getId(type, record);
        }

        var path = [type, id];

        return this.transform({op: 'remove', path: path});
      },

      _addLink: function(type, id, key, value) {
        // Normalize ids
        if (id !== null && typeof id === 'object') {
          var record = this.normalize(type, id);
          id = this.getId(type, record);
        }
        if (value !== null && typeof value === 'object') {
          var linkDef = this.schema.models[type].links[key];
          var relatedRecord = this.normalize(linkDef.model, value);
          value = this.getId(linkDef.model, relatedRecord);
        }

        return this.transform(this._addLinkOp(type, id, key, value));
      },

      _removeLink: function(type, id, key, value) {
        // Normalize ids
        if (id !== null && typeof id === 'object') {
          var record = this.normalize(type, id);
          id = this.getId(type, record);
        }
        if (value !== null && typeof value === 'object') {
          var linkDef = this.schema.models[type].links[key];
          var relatedRecord = this.normalize(linkDef.model, value);
          value = this.getId(linkDef.model, relatedRecord);
        }

        return this.transform(this._removeLinkOp(type, id, key, value));
      },

      /////////////////////////////////////////////////////////////////////////////
      // Event handlers
      /////////////////////////////////////////////////////////////////////////////

      _cacheDidTransform: function(operation, inverse) {
        this.didTransform(operation, inverse);
      },

      /////////////////////////////////////////////////////////////////////////////
      // Helpers
      /////////////////////////////////////////////////////////////////////////////

      normalize: function(type, data) {
        return this.schema.normalize(type, data);
      },

      initDefaults: function(type, record) {
        return this.schema.initDefaults(type, record);
      },

      getId: function(type, data) {
        if (data !== null && typeof data === 'object') {
          return data[this.schema.models[type].primaryKey.name];
        } else {
          return data;
        }
      },

      retrieveLink: function(type, id, link) {
        var val = this.retrieve([type, id, '__rel', link]);
        if (val !== null && typeof val === 'object') {
          val = Object.keys(val);
        }
        return val;
      },

      /////////////////////////////////////////////////////////////////////////////
      // Internals
      /////////////////////////////////////////////////////////////////////////////

      _isLinkEmpty: function(linkType, linkValue) {
        return (linkType === 'hasMany' && linkValue && linkValue.length === 0 ||
                linkType === 'hasOne' && isNone(linkValue));
      },

      _addLinkOp: function(type, id, key, value) {
        var linkDef = this.schema.models[type].links[key];
        var path = [type, id, '__rel', key];

        if (linkDef.type === 'hasMany') {
          path.push(value);
          value = true;
        }

        return {
          op: 'add',
          path: path,
          value: value
        };
      },

      _removeLinkOp: function(type, id, key, value) {
        var linkDef = this.schema.models[type].links[key];
        var path = [type, id, '__rel', key];

        if (linkDef.type === 'hasMany') {
          path.push(value);
        }

        return {
          op: 'remove',
          path: path
        };
      }
    });

    __exports__["default"] = Source;
  });
global.OC = requireModule("orbit-common")["default"];
}(window));