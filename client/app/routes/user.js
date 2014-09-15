export default Ember.Route.extend({
	model: function(params){
		return this.store.find('user', params.user_id).then(function(users){return users.objectAt(0)});
	}
});