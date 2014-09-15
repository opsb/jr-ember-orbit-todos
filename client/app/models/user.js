import EO from 'ember-orbit';
import Orbit from 'orbit';

var attr = EO.attr;
var key = EO.key;
var hasMany = EO.hasMany;

export
default EO.Model.extend({
	id:  key({primaryKey: true, defaultValue: Orbit.uuid}),
    email: attr("string"),
    firstName: attr("string"),
    lastName: attr("string"),
    todos: hasMany('todo', {inverse: 'user'})
});