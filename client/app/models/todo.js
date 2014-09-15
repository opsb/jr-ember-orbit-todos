import EO from 'ember-orbit';
import Orbit from 'orbit';

var attr = EO.attr;
var key = EO.key;
var hasOne = EO.hasOne;

export default EO.Model.extend({
	id:  key({primaryKey: true, defaultValue: Orbit.uuid}),
	title: attr('string'),
	description: attr('string'),
	user: hasOne('user', {inverse: 'todos'})
});
