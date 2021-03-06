'use strict';

describe('Resource', function () {

    var fixtures,
        hyperLoaderSpy;

    beforeEach(module('hyperagent'));

    describe('options', function () {
        var HyperResource;

        beforeEach(module(function ($provide) {
            hyperLoaderSpy = jasmine.createSpy('hyperLoaderSpy');

            $provide.decorator('hyperLoader', function ($delegate) {
                // hyperLoaderSpy.and.callFake($delegate);
                return hyperLoaderSpy;
            });
        }));

        beforeEach(inject(function (_HyperResource_, _fixtures_) {
            HyperResource = _HyperResource_;
            fixtures = _fixtures_;
        }));

        it('should initialize', function () {
            var agent = new HyperResource('http://example.com/');
            expect(agent.fetch).toBeTruthy();
        });

        it('should refresh', function () {
            var agent = new HyperResource('http://example.com/'),
                promise;
            spyOn(agent, 'fetch').and.returnValue('promise');
            promise = agent.refresh();
            expect(promise).toBe('promise');
            expect(agent.fetch).toHaveBeenCalledWith({ force: true });
        });

        it('should accept options hash', function () {
            var agent = new HyperResource({
                url: 'http://example.com/'
            });
            expect(agent.fetch).toBeTruthy();
        });

        it('should resolve URLs', function () {
            var result = HyperResource.resolveUrl('http://example.com/foo',
                '/bar');
            expect(result).toEqual('http://example.com/bar');
        });

        it('should return its url', function () {
            var agent = new HyperResource('http://example.com/');
            expect(agent.url()).toEqual('http://example.com/');
        });

        it('should return its url from an options hash', function () {
            var agent = new HyperResource({ url: 'http://example.com/' });
            expect(agent.url()).toEqual('http://example.com/');
        });

        it('should not be loaded by default', function () {
            var agent = new HyperResource({ url: 'http://example.com/' });
            expect(agent.loaded).toBe(false);
        });

        it('should normalize relative paths', function () {
            var agent = new HyperResource({
                url: 'http://example.com/subresource'
            });
            agent._load({ _links: { order: { href: '../orders' } } });
            expect(agent.links.order.url()).toEqual('http://example.com/orders');
        });

        it('should absolutize paths', function () {
            var agent = new HyperResource({
                url: 'http://example.com/subresource/nested'
            });
            agent._load({ _links: { order: { href: '/orders' } } });
            expect(agent.links.order.url()).toEqual('http://example.com/orders');
        });

        it('should absolutize full urls', function () {
            var agent = new HyperResource({
                url: 'http://example.com/subresource/nested'
            });
            agent._load({ _links: { order: { href: 'http://example.com/orders' } } });
            expect(agent.links.order.url()).toBe('http://example.com/orders');
        });

        it('should support expanded curies in properties', function () {
            var agent = new HyperResource({
                url: 'http://example.com/'
            });

            agent._load({
                _links: {
                    curies: [
                        {
                            name: 'ex',
                            href: 'http://example.com/rels/{rel}',
                            templated: true
                        }
                    ]
                },

                'ex:order': {
                    bought: true
                }
            });

            var order1 = agent.props['ex:order'];
            var order2 = agent.props['http://example.com/rels/order'];

            expect(order1).toBeTruthy();
            expect(order1).toEqual(order2);
        });
    });

    describe('Resource methods', function () {
        var agent,
            HyperResource;

        beforeEach(inject(function (_HyperResource_, _fixtures_) {
            HyperResource = _HyperResource_;
            fixtures = _fixtures_;
        }));

        beforeEach(function () {
            agent = new HyperResource({ url: 'http://example.com/' });
        });


        describe('Resource.props', function () {

            it('should be iterable', function () {
                agent._load({prop1: 1, prop2: 2, prop3: 3});
                var pairs = _.pairs(agent.props);
                expect(pairs).toEqual([
                    ['prop1', 1],
                    ['prop2', 2],
                    ['prop3', 3]
                ]);
            });
        });

        describe('Resource.embedded', function () {

            it('should expose embedded after loading', function () {
                agent._load(fixtures.embeddedOrders);
                expect(agent.embedded.single.props.title).toBe('yours truly');
                expect(agent.embedded.orders.length).toBe(2);
                expect(agent.embedded.orders[0].props.status).toBe('shipped');
            });

            it('should support recursively embedded resources', function () {
                agent._load(fixtures.recursiveEmbed);

                expect(agent.embedded.single.embedded.user.props.title).toBe('passy');
            });

            it('should have loaded embeds', function () {
                agent._load(fixtures.embeddedOrders);

                expect(agent.embedded.single.loaded).toBeTruthy();
                expect(agent.embedded.orders[0].loaded).toBeTruthy();
            });

            it('should have the self url of the embedded resource', function () {
                agent._load(fixtures.embeddedOrders);

                expect(agent.embedded.single.url()).toBe('http://example.com/self/');
            });

            it('should be iterable', function () {
                agent._load(fixtures.embeddedOrders);

                var keys = Object.keys(agent.embedded);
                expect(keys).toEqual(['orders', 'single']);
            });
        });

        describe('Resource.links', function () {
            beforeEach(function () {
                agent = new HyperResource({ url: 'http://example.com/' });
            });

            it('should be cached', function () {
                agent._load({ _links: { orders: { href: 'http://example.com/orders' } } });
                expect(agent.links.orders).toEqual(agent.links.orders);
            });

            it('should expose their props', function () {
                agent._load({ _links: { self: { href: 'http://example.com/self' } } });
                expect(agent.links.self.props.href).toBe('http://example.com/self');
            });

            it('should expose self link without fetching', function () {
                agent._load({ _links: { self: { href: 'http://example.com/self' } } });
                expect(agent.links.self.url()).toBe('http://example.com/self');
            });

            it('should have its self href as url', function () {
                agent._load(fixtures.simpleLink);

                expect(agent.links.orders.url()).toBe('https://example.com/orders/');
            });

            it('should be iterable', function () {
                agent._load(fixtures.simpleLink);

                var keys = Object.keys(agent.links);
                expect(keys).toEqual(['self', 'orders']);
            });

            it('should not override pre-loaded link properties', function () {
                agent._load(fixtures.extendedLink);
                var orders = agent.links.orders;

                expect(orders.props.title).toBe('Orders');
                orders._load({
                    description: 'Some fancy list of orders.'
                });

                expect(orders.props.title).toBe('Orders');
                expect(orders.props.description).toBe('Some fancy list of orders.');
            });

            it('should allow single links in a rel array', function () {
                agent._load({ _links: { stuff: [
                    { href: 'http://example.com/stuff' }
                ] } });

                expect(agent.link('stuff').url()).toBe('http://example.com/stuff')
            });

            it('should throw an error in a rel array contains more than one links', function () {
                agent._load({ _links: { stuff: [
                    { href: 'http://example.com/stuff' },
                    { href: 'http://example.com/stuff2' }
                ] } });

                expect(function () {
                    agent.link('stuff');
                }).toThrowError('Found a link array with more than one item - still need to add support for this');
            });

            describe('Templated Links', function () {
                it('should expand links', function () {
                    agent._load({ _links: {
                        user: { href: 'http://example.com/users/{user}', templated: true }
                    } });
                    var link = agent.link('user', { user: 'passy' });
                    expect(link.url()).toBe('http://example.com/users/passy');
                });

                it('should be equivalent to call link or access links', function () {
                    agent._load({ _links: {
                        users: { href: 'http://example.com/users/' } }
                    });
                    expect(agent.link('users')).toEqual(agent.links['users']);
                });
            });

            describe('CURIE Links', function () {
                it('should treat CURIE links like normal links', function () {
                    agent._load({ _links: {
                        'ht:users': { href: '/users/' },
                        curies: [
                            {
                                name: 'ht',
                                href: 'http://example.com/rels/{rel}',
                                templated: true
                            }
                        ]
                    } });

                    var link = agent.links['ht:users'];
                    var link2 = agent.links['http://example.com/rels/users'];

                    expect(link).toBeTruthy();
                    expect(link).toEqual(link2);
                });

                it('should not make expanded CURIES enumerable', function () {
                    agent._load({ _links: {
                        'ht:users': { href: '/users/' },
                        curies: [
                            {
                                name: 'ht',
                                href: 'http://example.com/rels/{rel}',
                                templated: true
                            }
                        ]
                    } });

                    var links = Object.keys(agent.links);
                    expect(links).toEqual(['ht:users']);
                });
            });
        });
    });

    describe('Resource#fetch', function () {
        var agent,
            $httpBackend,
            HyperResource;

        describe('Resource#fetch#loaderReturnPromise', function () {
            var q,
                deferLoader,
                rootScope;

            beforeEach(module('hyperagent'));

            beforeEach(module(function ($provide) {
                var mockHyperLoader = function () {
                    deferLoader = q.defer();
                    return deferLoader.promise;
                };
                $provide.value('hyperLoader', mockHyperLoader);
            }));


            beforeEach(inject(function (_HyperResource_, _fixtures_, _$q_, _$rootScope_) {
                HyperResource = _HyperResource_;
                fixtures = _fixtures_;
                rootScope = _$rootScope_;
                q = _$q_;
            }));

            describe('201 response', function () {
                it('should get the resource from the locator header and fetch it again', function () {
                    var responseMock1 = {
                            status: 201,
                            headers: jasmine.createSpy('A headers spy')
                        },
                        responseMock2 = {
                            status: 200,
                            data: 'Fetched resource'
                        },
                        agent = new HyperResource({
                            url: 'http://itWillRedirect.com/',
                            ajax: { headers: { 'X-Awesome': '23' }, cache: false }
                        });

                    responseMock1.headers.and.returnValue('http://aRedirect.com');
                    spyOn(agent, '_load');

                    agent.fetch();
                    deferLoader.resolve(responseMock1);
                    rootScope.$digest();
                    deferLoader.resolve(responseMock2);
                    rootScope.$digest();

                    expect(agent._load).toHaveBeenCalledWith('Fetched resource');
                    expect(responseMock1.headers).toHaveBeenCalledWith('location');
                    expect(agent.loaded).toBe(true);
                });
                it('should stop redirect if more then 2 redirects', function () {
                    var responseMock1 = {
                            status: 201,
                            headers: jasmine.createSpy('A headers spy')
                        },
                        result = null,
                        agent = new HyperResource({
                            url: 'http://itWillRedirect.com/',
                            ajax: { headers: { 'X-Awesome': '23' }, cache: false }
                        });

                    responseMock1.headers.and.returnValue('http://aRedirect.com');
                    spyOn(agent, '_load');
                    agent.maxNumberOfRedirect = 2;

                    agent.fetch().catch(function (msg) {
                        result = msg;
                    });
                    deferLoader.resolve(responseMock1);
                    rootScope.$digest();
                    deferLoader.resolve(responseMock1);
                    rootScope.$digest();
                    deferLoader.resolve(responseMock1);
                    rootScope.$digest();

                    expect(result).toEqual('Exceed max number of redirects');
                    expect(agent._load).not.toHaveBeenCalled();
                    expect(agent.loaded).toBe(false);
                });
            });

            describe('204 response', function () {
                var q;

                beforeEach(inject(function (_$q_) {
                    q = _$q_;

                }));


                it('should not load agent if 204 response', function () {
                    var responseMock = {
                            status: 204
                        },
                        agent;

                    agent = new HyperResource({
                        url: 'http://example.com/',
                        ajax: { headers: { 'X-Awesome': '23' }, cache: false }
                    });

                    spyOn(agent, '_load');

                    agent.fetch();

                    deferLoader.resolve(responseMock);

                    rootScope.$digest();

                    expect(agent._load).not.toHaveBeenCalled();
                    expect(agent.loaded).toBe(false);
                });

                it('should load agent if 200 response', function () {
                    var responseMock = {
                            status: 200
                        },
                        agent;

                    agent = new HyperResource({
                        url: 'http://example.com/',
                        ajax: { headers: { 'X-Awesome': '23' }, cache: false }
                    });

                    spyOn(agent, '_load');

                    agent.fetch();

                    deferLoader.resolve(responseMock);

                    rootScope.$digest();

                    expect(agent._load).toHaveBeenCalled();
                    expect(agent.loaded).toBe(true);
                });
            });
        });
        describe('Resource#fetch#loaderReturnMock', function () {


            beforeEach(module(function ($provide) {
                hyperLoaderSpy = jasmine.createSpy('hyperLoaderSpy');

                $provide.decorator('hyperLoader', function ($delegate) {
                    hyperLoaderSpy.and.callFake($delegate);
                    return hyperLoaderSpy;
                });
            }));

            beforeEach(inject(function (_HyperResource_, _fixtures_, _$httpBackend_) {
                HyperResource = _HyperResource_;
                fixtures = _fixtures_;
                $httpBackend = _$httpBackend_;
            }));


            it('should mix in ajax options', function () {
                agent = new HyperResource('http://example.com');

                agent._load({ _links: {
                    users: { href: '/users/' }
                } });

                agent.links.users.fetch({ ajax: {
                    method: 'POST'
                } });

                expect(hyperLoaderSpy).toHaveBeenCalledWith({
                    url: 'http://example.com/users/',
                    method: 'POST'
                });
            });

            it('should override ressource-level ajax options', function () {

                var agent = new HyperResource({
                    url: 'http://example.com/',
                    ajax: { headers: { 'X-Awesome': '23' }, cache: false }
                });

                agent._load({ _links: {
                    users: { href: '/users/' }
                } });

                agent.links.users.fetch({ ajax: {
                    cache: true
                } });


                expect(hyperLoaderSpy).toHaveBeenCalledWith({
                    url: 'http://example.com/users/',
                    headers: { 'X-Awesome': '23' },
                    cache: true
                });
            });
        });


    });

    describe('Resource#hasLink', function () {
        var agent,
            $httpBackend,
            HyperResource;


        beforeEach(inject(function (_HyperResource_, _fixtures_) {
            HyperResource = _HyperResource_;
            fixtures = _fixtures_;
        }));


        beforeEach(inject(function (_$httpBackend_) {
            agent = new HyperResource('http://example.com');
            $httpBackend = _$httpBackend_;
        }));

        it('should return true if the given link is contained within the resource', function () {
            agent._load({
                _links: {
                    'good-link': { href: 'href' }
                }
            });

            expect(agent.hasLink('good-link')).toBe(true);
            expect(agent.hasLink('bad-link')).toBe(false);
        });
    });

    describe('Resource#warnings', function () {
        var agent,
            $httpBackend,
            HyperResource;

        beforeEach(inject(function (_HyperResource_, _fixtures_) {
            HyperResource = _HyperResource_;
            fixtures = _fixtures_;
        }));

        beforeEach(inject(function (_$httpBackend_) {
            agent = new HyperResource('http://example.com');
            $httpBackend = _$httpBackend_;
        }));

        it('should return a list of warning keys for a missing link', function () {
            agent._load({
                _links: {
                    'good-link': { href: 'href' }
                },
                _warnings: [
                    {
                        'bad-link': {
                            badThing: true,
                            anotherBadThing: false
                        }
                    }
                ]
            });
            expect(agent.linkWarnings('bad-link')).toEqual(['badThing', 'anotherBadThing']);
        });

        it('should return a default warning if the link is missing but there are no specific warnings', function () {
            agent._load({
                _links: {
                    'good-link': { href: 'href' }
                }
            });
            expect(agent.linkWarnings('another-bad-link')).toEqual(['unknownLinkError']);
        });

        it('should return an empty array if the link is present', function () {
            agent._load({
                _links: {
                    'good-link': { href: 'href' }
                }
            });
            expect(agent.linkWarnings('good-link')).toEqual([]);
        });
    });
});
