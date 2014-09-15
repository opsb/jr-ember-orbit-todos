export default Ember.Route.extend({
	model: function(params){
		return this.store.retrieve('user', params.user_id);
	}
});